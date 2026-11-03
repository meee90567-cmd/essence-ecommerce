import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
function adminClient(){
 const url=Deno.env.get("SUPABASE_URL"); const raw=Deno.env.get("SUPABASE_SECRET_KEYS");
 const keys=raw?JSON.parse(raw):null; const key=keys?(keys.default??Object.values(keys)[0]):Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key) throw new Error("Supabase server credentials unavailable");
 return createClient(url,String(key),{auth:{persistSession:false}});
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({error:"Method not allowed"},405);
 try{
  const secret=Deno.env.get("PAYSTACK_SECRET_KEY"); if(!secret) return reply({error:"Payment service is not configured yet."},503);
  const b=await req.json(); const name=String(b.name??"").trim().slice(0,120);
  const email=String(b.email??"").trim().toLowerCase(); const phone=String(b.phone??"").trim().slice(0,40);
  const address=String(b.address??"").trim().slice(0,500); const items=Array.isArray(b.items)?b.items:[];
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.length<7||address.length<8||items.length<1||items.length>30)
   return reply({error:"Please provide valid contact, delivery and cart details."},400);
  const quantities=new Map<string,number>();
  for(const item of items){const id=String(item.id??"");const q=Number(item.quantity);
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!Number.isInteger(q)||q<1||q>20)
    return reply({error:"Your bag contains an invalid item. Refresh and try again."},400);
   quantities.set(id,Math.min(20,(quantities.get(id)??0)+q));
  }
  const db=adminClient(); const ids=[...quantities.keys()];
  const {data:products,error:pe}=await db.from("products").select("id,name,price").in("id",ids).eq("is_active",true);
  if(pe) throw pe; if(!products||products.length!==ids.length) return reply({error:"A product is no longer available. Refresh your bag."},409);
  const lines=ids.map(id=>{const p=products.find(x=>x.id===id)!;const quantity=quantities.get(id)!;const unit=Number(p.price);return {product_id:id,product_name:p.name,quantity,unit_price:unit,line_total:Number((unit*quantity).toFixed(2))};});
  const total=Number(lines.reduce((s,x)=>s+x.line_total,0).toFixed(2));const amount=Math.round(total*100);
  if(!Number.isSafeInteger(amount)||amount<100)return reply({error:"Invalid order total."},400);
  const reference="ESS-"+crypto.randomUUID();
  const {data:order,error:oe}=await db.from("orders").insert({customer_name:name,customer_email:email,customer_phone:phone,delivery_address:address,total_amount:total,currency:"NGN",status:"pending",paystack_reference:reference}).select("id").single();
  if(oe)throw oe;
  const {error:ie}=await db.from("order_items").insert(lines.map(x=>({...x,order_id:order.id})));
  if(ie){await db.from("orders").delete().eq("id",order.id);throw ie;}
  const res=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/json"},body:JSON.stringify({email,amount:String(amount),currency:"NGN",reference,callback_url:"https://essence-ecommerce.onrender.com/",metadata:{order_id:order.id,customer_name:name}})});
  const p=await res.json();if(!res.ok||!p.status||!p.data?.authorization_url){await db.from("orders").update({status:"failed"}).eq("id",order.id);return reply({error:p.message??"Paystack could not start payment."},502);}
  return reply({authorization_url:p.data.authorization_url,reference});
 }catch(e){console.error("paystack-checkout",e);return reply({error:"We could not start checkout. Please try again."},500);}
});
