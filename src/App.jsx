import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const demoProducts = [
  { id: 'd1', name: 'The Everyday Tote', category: 'Accessories', price: 18500, description: 'A considered carryall for wherever the day leads.', image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85', featured: true },
  { id: 'd2', name: 'Sculpted Ceramic Vase', category: 'Home', price: 24500, description: 'Quiet form. Beautiful presence.', image_url: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=900&q=85', featured: true },
  { id: 'd3', name: 'Soft Form Candle', category: 'Living', price: 12000, description: 'A warm, grounding note for slower evenings.', image_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85', featured: false },
  { id: 'd4', name: 'Weekend Essential', category: 'Accessories', price: 32000, description: 'An effortless piece made to be reached for often.', image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=85', featured: true },
  { id: 'd5', name: 'Linen Table Edit', category: 'Home', price: 28000, description: 'Natural texture for everyday rituals.', image_url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85', featured: false },
  { id: 'd6', name: 'Daily Ritual Set', category: 'Living', price: 16500, description: 'Small details that make a day feel intentional.', image_url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=85', featured: false }
]

const money = value => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0
}).format(Number(value || 0))

function Icon({ name }) {
  const paths = {
    bag: <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <path d="M5 12h14"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function App() {
  const [products, setProducts] = useState(demoProducts)
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(window.localStorage?.getItem('essence-cart') || '[]') } catch { return [] }
  })
  const [cartOpen, setCartOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [checkout, setCheckout] = useState({ name: '', email: '', phone: '', address: '' })
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  useEffect(() => {
    try { window.localStorage?.setItem('essence-cart', JSON.stringify(cart)) } catch { /* Storage may be unavailable in private or embedded browsers. */ }
  }, [cart])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    async function load() {
      const { data, error } = await supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false })
      if (!alive) return
      if (!error && data?.length) setProducts(data)
      setLoading(false)
    }
    load()
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference') || params.get('trxref')
    if (!reference || !isSupabaseConfigured) return
    let active = true
    async function verifyPayment() {
      setNotice('Confirming your payment…')
      const { data, error } = await supabase.functions.invoke('paystack-verify', { body: { reference } })
      if (!active) return
      if (!error && data?.success) {
        setCart([])
        setCartOpen(false)
        setNotice('Payment confirmed. Thank you for shopping with ESSENCE.')
      } else {
        setNotice(data?.error || error?.message || 'We could not confirm this payment yet.')
      }
      params.delete('reference')
      params.delete('trxref')
      params.delete('status')
      const query = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
    }
    verifyPayment()
    return () => { active = false }
  }, [])

  async function startCheckout(event) {
    event.preventDefault()
    setCheckoutBusy(true)
    setCheckoutError('')
    try {
      const { data, error } = await supabase.functions.invoke('paystack-checkout', {
        body: {
          ...checkout,
          items: cart.map(item => ({ id: item.id, quantity: item.quantity })),
        },
      })
      if (error) throw new Error(data?.error || error.message || 'Unable to start checkout.')
      if (!data?.authorization_url) throw new Error(data?.error || 'Paystack did not return a checkout link.')
      window.location.assign(data.authorization_url)
    } catch (error) {
      setCheckoutError(error.message || 'Unable to start checkout. Please try again.')
      setCheckoutBusy(false)
    }
  }

  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))]
  const visibleProducts = useMemo(() => products.filter(p => {
    const matchesCategory = category === 'All' || p.category === category
    const matchesQuery = [p.name, p.category, p.description].join(' ').toLowerCase().includes(query.toLowerCase())
    return matchesCategory && matchesQuery
  }), [products, category, query])

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  const cartReadyForCheckout = cart.length > 0 && cart.every(item => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(item.id)))

  function addToCart(product) {
    setCart(current => {
      const found = current.find(item => item.id === product.id)
      return found
        ? current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }]
    })
    setNotice('Added to your bag')
    window.setTimeout(() => setNotice(''), 2200)
  }

  function changeQuantity(id, amount) {
    setCart(current => current.map(item => item.id === id ? { ...item, quantity: item.quantity + amount } : item).filter(item => item.quantity > 0))
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function saveProduct(form, imageFile, productId = null) {
    let imageUrl = form.image_url.trim()
    if (imageFile) {
      const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[imageFile.type]
      if (!extension || imageFile.size > 5 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP image under 5 MB.')
      const path = `${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`
      const { data: upload, error: uploadError } = await supabase.storage.from('product-images').upload(path, imageFile, { cacheControl: '3600', upsert: false, contentType: imageFile.type })
      if (uploadError) throw uploadError
      imageUrl = supabase.storage.from('product-images').getPublicUrl(upload.path).data.publicUrl
    }
    if (!imageUrl) throw new Error('Please choose a product image.')
    const productData = {
      name: form.name, category: form.category, price: Number(form.price),
      description: form.description, image_url: imageUrl, is_active: true
    }
    const { error } = productId
      ? await supabase.from('products').update(productData).eq('id', productId)
      : await supabase.from('products').insert(productData)
    if (error) throw error
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (data) setProducts(data)
    setNotice(productId ? 'Product updated' : 'Product published')
    setAdminOpen(false)
  }

  async function deleteProduct(productId) {
    const { error } = await supabase.from('products').delete().eq('id', productId)
    if (error) throw error
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (data) setProducts(data)
    setNotice('Product deleted')
  }

  return (
    <div className="site-shell">
      <div className="announcement">A little more intention in every day <span>✳</span> Thoughtfully selected essentials</div>
      <header className="header">
        <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu"/></button>
        <a className="wordmark" href="#" aria-label="ESSENCE home">ESSENCE<span>®</span></a>
        <nav className={menuOpen ? 'nav nav-open' : 'nav'}>
          <a href="#shop" onClick={() => setMenuOpen(false)}>Shop</a>
          <a href="#story" onClick={() => setMenuOpen(false)}>Our story</a>
          <a href="#journal" onClick={() => setMenuOpen(false)}>The journal</a>
        </nav>
        <div className="header-actions">
          <button className="icon-button search-toggle" aria-label="Focus search" onClick={() => document.getElementById('product-search')?.focus()}><Icon name="search"/></button>
          <button className="bag-button" onClick={() => setCartOpen(true)}><span>Bag</span><span className="bag-count">{cartCount}</span></button>
        </div>
      </header>

      <main>
        <section className="hero">
          <img className="hero-image" src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=2000&q=90" alt="Calm, sunlit contemporary living space" />
          <div className="hero-shade"/>
          <div className="hero-content">
            <p className="eyebrow light">THE ART OF EVERYDAY LIVING</p>
            <h1>Find beauty<br/>in the <em>everyday.</em></h1>
            <p className="hero-copy">Thoughtful pieces. Timeless feeling.<br/>A life, more intentionally lived.</p>
            <a className="button button-light" href="#shop">Explore the collection <Icon name="arrow"/></a>
          </div>
          <div className="hero-note"><span>01 / 03</span><span>CONSIDERED LIVING, ALWAYS</span></div>
        </section>

        <section className="intro-strip">
          <p>LESS, BUT <em>BETTER.</em></p>
          <span>Objects and essentials chosen to bring a little more meaning to the everyday.</span>
          <span className="intro-mark">✳</span>
        </section>

        <section className="shop-section section-pad" id="shop">
          <div className="section-heading">
            <div><p className="eyebrow">THE ESSENCE EDIT</p><h2>Considered <em>essentials.</em></h2></div>
            <p className="section-aside">A curated collection for the spaces you inhabit<br className="desktop-break"/> and the moments that make them yours.</p>
          </div>
          <div className="shop-tools">
            <div className="category-list">
              {categories.map(item => <button key={item} className={category === item ? 'category active' : 'category'} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
            <label className="search-field"><Icon name="search"/><input id="product-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find something..." /></label>
          </div>
          {loading && <p className="loading-note">Gathering the collection…</p>}
          <div className="product-grid">
            {visibleProducts.map((product, index) => <article className="product-card" key={product.id}>
              <div className="product-image-wrap">
                <img src={product.image_url || 'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=900&q=80'} alt={product.name} loading="lazy"/>
                {product.featured && <span className="product-tag">THE EDIT</span>}
                <button className="quick-add" onClick={() => addToCart(product)}>Add to bag <Icon name="plus"/></button>
              </div>
              <div className="product-info"><div><h3>{product.name}</h3><p>{product.category}</p></div><strong>{money(product.price)}</strong></div>
              {product.description && <p className="product-description">{product.description}</p>}
            </article>)}
          </div>
          {!visibleProducts.length && <div className="empty-state"><p>Nothing here just yet.</p><button onClick={() => { setCategory('All'); setQuery('') }}>View all pieces</button></div>}
          <div className="collection-foot"><span>SHOWING {visibleProducts.length} PIECES</span><span>MADE FOR THE WAY YOU LIVE <b>✳</b></span></div>
        </section>

        <section className="story-section" id="story">
          <div className="story-image"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85" alt="Warm, tactile and thoughtfully arranged interior"/></div>
          <div className="story-copy"><p className="eyebrow">A NOTE FROM ESSENCE</p><h2>It's not about<br/>having more.<br/>It's about <em>feeling more.</em></h2><p>We believe the things around us should mean something. ESSENCE is a growing collection of considered finds — selected for their character, usefulness and the quiet joy they bring to everyday life.</p><a className="text-link" href="#journal">A little about us <Icon name="arrow"/></a></div>
        </section>

        <section className="values-section" id="journal">
          <div><span>01</span><h3>Thoughtfully chosen</h3><p>Every piece earns its place in the collection.</p></div>
          <div><span>02</span><h3>Made for everyday</h3><p>Beautiful things should be lived with, not kept away.</p></div>
          <div><span>03</span><h3>Always evolving</h3><p>A considered edit, with something new to discover.</p></div>
        </section>

        <section className="newsletter">
          <p className="eyebrow light">A NOTE FROM US, NOW AND THEN</p><h2>Make room for <em>good things.</em></h2><p>New finds, thoughtful inspiration and little moments worth sharing.</p>
          <a href="#shop" className="button button-outline">Explore ESSENCE <Icon name="arrow"/></a>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top"><a className="wordmark footer-mark" href="#">ESSENCE<span>®</span></a><p>Considered living.<br/>Every single day.</p><div className="footer-links"><a href="#shop">Shop</a><a href="#story">Our story</a><button onClick={() => setAdminOpen(true)}>Store admin</button></div></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} ESSENCE. ALL RIGHTS RESERVED.</span><span>MADE WITH INTENTION <b>✳</b></span><span>PRICES IN NIGERIAN NAIRA (₦)</span></div>
      </footer>

      {notice && <div className="toast">{notice}</div>}

      {cartOpen && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setCartOpen(false)}><aside className="cart-drawer">
        <div className="drawer-head"><div><p className="eyebrow">YOUR SELECTION</p><h2>Your bag <span>({cartCount})</span></h2></div><button className="icon-button" aria-label="Close bag" onClick={() => setCartOpen(false)}><Icon name="close"/></button></div>
        {cart.length ? <><div className="cart-items">{cart.map(item => <div className="cart-item" key={item.id}><img src={item.image_url} alt={item.name}/><div className="cart-item-info"><h3>{item.name}</h3><p>{money(item.price)}</p><div className="quantity"><button onClick={() => changeQuantity(item.id, -1)} aria-label="Decrease quantity"><Icon name="minus"/></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} aria-label="Increase quantity"><Icon name="plus"/></button></div></div><strong>{money(item.price * item.quantity)}</strong></div>)}</div><div className="cart-bottom"><div className="subtotal"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Enter your delivery details to continue to secure payment by Paystack.</p><form className="checkout-form" onSubmit={startCheckout}><label>Full name<input required minLength="2" autoComplete="name" value={checkout.name} onChange={e => setCheckout({ ...checkout, name: e.target.value })} /></label><label>Email address<input required type="email" autoComplete="email" value={checkout.email} onChange={e => setCheckout({ ...checkout, email: e.target.value })} /></label><label>Phone number<input required type="tel" autoComplete="tel" value={checkout.phone} onChange={e => setCheckout({ ...checkout, phone: e.target.value })} /></label><label>Delivery address<textarea required minLength="8" rows="2" autoComplete="street-address" value={checkout.address} onChange={e => setCheckout({ ...checkout, address: e.target.value })} /></label>{!cartReadyForCheckout && <p className="cart-checkout-note">Checkout is available once live products have been published in Store Admin.</p>}{checkoutError && <p className="form-error">{checkoutError}</p>}<button className="button button-dark full" disabled={checkoutBusy || !isSupabaseConfigured || !cartReadyForCheckout}>{checkoutBusy ? 'Connecting to Paystack…' : 'Continue to payment'}</button></form><button className="continue-link" onClick={() => setCartOpen(false)}>Continue exploring</button></div></> : <div className="cart-empty"><span>✳</span><h3>Your bag is waiting.</h3><p>Find something that feels like you.</p><button className="button button-dark" onClick={() => setCartOpen(false)}>Explore the collection</button></div>}
      </aside></div>}

      {adminOpen && <AdminPanel session={session} products={products} onClose={() => setAdminOpen(false)} onSignIn={signIn} onSave={saveProduct} onDelete={deleteProduct}/>}
      {!isSupabaseConfigured && <div className="setup-ribbon">Preview collection · Connect Supabase to manage live products</div>}
    </div>
  )
}

function AdminPanel({ session, products, onClose, onSignIn, onSave, onDelete }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [form, setForm] = useState({ name: '', category: 'Home', price: '', description: '', image_url: '' })
  const [imageFile, setImageFile] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isAdmin = session?.user?.app_metadata?.is_admin === true

  async function submitLogin(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { await onSignIn(email, password) } catch (err) { setError(err.message || 'Unable to sign in') }
    finally { setBusy(false) }
  }
  async function submitProduct(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { await onSave(form, imageFile, editingId) } catch (err) { setError(err.message || 'Unable to save product') }
    finally { setBusy(false) }
  }
  return <div className="overlay admin-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="admin-panel">
    <div className="drawer-head"><div><p className="eyebrow">ESSENCE BACK OFFICE</p><h2>Store admin</h2></div><button className="icon-button" onClick={onClose} aria-label="Close admin"><Icon name="close"/></button></div>
    {!isSupabaseConfigured ? <div className="admin-message"><h3>Store management is almost ready.</h3><p>Connect a Supabase project and add its public URL and publishable key to the deployment settings to enable secure product management.</p></div> : !session ? <form className="admin-form" onSubmit={submitLogin}><p>Sign in with your authorised store account.</p><label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input type="password" required value={password} onChange={e => setPassword(e.target.value)}/></label><button className="button button-dark full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form> : !isAdmin ? <div className="admin-message"><h3>Access not authorised.</h3><p>This account is signed in but does not have the ESSENCE administrator role. Ask the project owner to grant the admin role securely in Supabase.</p><button className="text-link" onClick={() => supabase.auth.signOut()}>Sign out</button></div> : <><form className="admin-form" onSubmit={submitProduct}><p>{editingId ? 'Update this piece in your live collection.' : 'Add a new piece to the live collection.'}</p><label>Product name<input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></label><div className="form-row"><label>Category<input required value={form.category} onChange={e => setForm({...form, category: e.target.value})}/></label><label>Price (₦)<input required type="number" min="1" value={form.price} onChange={e => setForm({...form, price: e.target.value})}/></label></div><label>Description<textarea rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></label><label>Product image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setImageFile(e.target.files?.[0] || null)}/><small>JPG, PNG or WebP · Maximum 5 MB</small></label><label>Or use an image URL<input type="url" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="https://..."/></label>{error && <p className="form-error">{error}</p>}<button className="button button-dark full" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Publish product'}</button>{editingId && <button type="button" className="continue-link" onClick={() => { setEditingId(null); setForm({ name: '', category: 'Home', price: '', description: '', image_url: '' }); setImageFile(null); setError('') }}>Cancel editing</button>}</form><div className="admin-inventory"><div className="admin-inventory-heading"><h3>Live products</h3><span>{products.length} items</span></div>{products.length ? products.map(product => <div className="admin-product-row" key={product.id}><img src={product.image_url} alt=""/><div className="admin-product-details"><strong>{product.name}</strong><span>{product.category} · {money(product.price)}</span></div><button type="button" onClick={() => { setEditingId(product.id); setForm({ name: product.name, category: product.category, price: String(product.price), description: product.description || '', image_url: product.image_url || '' }); setImageFile(null); setError('') }}>Edit</button><button type="button" className="admin-delete" disabled={busy} onClick={async () => { if (!window.confirm('Delete this product from ESSENCE?')) return; setBusy(true); setError(''); try { await onDelete(product.id) } catch (err) { setError(err.message || 'Unable to delete product') } finally { setBusy(false) } }}>Delete</button></div>) : <p className="admin-empty">No live products yet. Publish your first product above.</p>}</div></>}
    {error && !session && <p className="form-error">{error}</p>}
  </section></div>
}

export default App