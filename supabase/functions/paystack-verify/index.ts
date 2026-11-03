import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
function adminClient(){
 const url=Deno.env.get("SUPABASE_URL");const raw=Deno.env.get("SUPABASE_SECRET_KEYS");const keys=raw?JSON.parse(raw):null;
 const key=keys?(keys.default??Object.values(keys)[0]):Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)throw new Error("Supabase server credentials unavailable");return createClient(url,String(key),{auth:{persistSession:false}});
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const secret=Deno.env.get("PAYSTACK_SECRET_KEY");if(!secret)return reply({error:"Payment service is not configured yet."},503);
  const b=await req.json();const ref=String(b.reference??"").trim();
  if(!/^ESS-[a-z0-9-]{20,60}$/i.test(ref))return reply({error:"Invalid payment reference."},400);
  const db=adminClient();const {data:o,error:oe}=await db.from("orders").select("id,total_amount,status,paystack_reference").eq("paystack_reference",ref).maybeSingle();
  if(oe)throw oe;if(!o)return reply({error:"Order not found."},404);if(o.status==="paid")return reply({success:true,already_paid:true});
  const response=await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(ref),{headers:{Authorization:"Bearer "+secret}});
  const result=await response.json();if(!response.ok||!result.status)return reply({error:"Payment verification is temporarily unavailable."},502);
  const p=result.data;const expected=Math.round(Number(o.total_amount)*100);
  const valid=p.status==="success"&&p.reference===o.paystack_reference&&p.currency==="NGN"&&Number(p.amount)===expected;
  if(!valid){if(["failed","reversed"].includes(p.status))await db.from("orders").update({status:"failed"}).eq("id",o.id).eq("status","pending");
   return reply({success:false,error:"Payment has not been confirmed. If charged, contact ESSENCE with your payment reference."},402);}
  const {error:ue}=await db.from("orders").update({status:"paid",paid_at:p.paid_at??new Date().toISOString()}).eq("id",o.id).eq("status","pending");
  if(ue)throw ue;return reply({success:true});
 }catch(e){console.error("paystack-verify",e);return reply({error:"We could not verify this payment yet. Please try again."},500);}
});
