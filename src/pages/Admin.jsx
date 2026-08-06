import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useImages, fileToResizedDataUrl } from '../imageStore.jsx'
import { useMenu } from '../menuStore.jsx'
import { usePromotions, statusOf, formatDateRange } from '../promotionsStore.jsx'
import { useSettings, getTier } from '../settingsStore.jsx'
import { useCustomers } from '../customerStore.jsx'
import { formatLKR } from '../format.js'
import { BRAND_LOGO_ID, BRAND_HERO_ID } from '../brand.js'

const ADMIN_PASSWORD = 'calista2026'
const SESSION_KEY = 'calista_admin_authed'

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  if (!authed) {
    return <Login onAuth={() => { sessionStorage.setItem(SESSION_KEY, '1'); setAuthed(true) }} />
  }
  return <Panel onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false) }} />
}

function Login({ onAuth }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const submit = (e) => {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) onAuth()
    else setErr(true)
  }
  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="font-display text-3xl mb-6 text-center">Admin sign in</h1>
      <form onSubmit={submit} className="bg-white border border-calista-ink/10 rounded-lg p-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium block mb-1">Password</span>
          <input
            type="password"
            value={pw}
            autoFocus
            onChange={(e) => { setPw(e.target.value); setErr(false) }}
            className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold"
          />
        </label>
        {err && <p className="text-sm text-red-600">Incorrect password.</p>}
        <button className="w-full bg-calista-ink text-calista-cream py-3 rounded-full font-semibold">
          Sign in
        </button>
        <p className="text-xs text-calista-ink/50 text-center">
          Demo password: <code className="bg-calista-cream px-1 rounded">calista2026</code>. Replace with real auth before going live.
        </p>
      </form>
    </div>
  )
}

function Panel({ onLogout }) {
  const { clearAll: clearImages, overrides } = useImages()
  const { resetToDefault } = useMenu()

  const customImageCount = Object.keys(overrides).length

  const handleResetMenu = () => {
    if (confirm('Reset the menu to the default categories and items? Uploaded images are kept.')) {
      resetToDefault()
    }
  }
  const handleClearImages = () => {
    if (confirm('Remove all uploaded images (logo, hero, menu items)?')) clearImages()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <h1 className="font-display text-4xl">Admin</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/qr"
            className="text-sm px-4 py-2 bg-calista-gold text-calista-ink rounded-full font-semibold hover:bg-calista-ink hover:text-calista-cream transition"
          >
            Table QR codes →
          </Link>
          <button
            onClick={handleResetMenu}
            className="text-sm px-4 py-2 border border-calista-ink/20 rounded-full hover:border-calista-gold"
          >
            Reset menu to default
          </button>
          {customImageCount > 0 && (
            <button
              onClick={handleClearImages}
              className="text-sm px-4 py-2 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600"
            >
              Clear uploaded images ({customImageCount})
            </button>
          )}
          <button
            onClick={onLogout}
            className="text-sm px-4 py-2 border border-calista-ink/20 rounded-full hover:border-calista-gold"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="text-calista-ink/60 mb-10">
        Everything you change here is saved in your browser and shows up on the public site immediately.
      </p>

      <SettingsSection />

      <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2">Brand</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        <BrandSlot
          id={BRAND_LOGO_ID}
          label="Logo"
          hint="Square. Shown in the top-left nav. Use the Facebook page profile photo."
          previewClassName="w-28 h-28 object-cover rounded-full bg-calista-cream"
        />
        <BrandSlot
          id={BRAND_HERO_ID}
          label="Hero image"
          hint="Wide. Shown behind the welcome text on the home page. Use the Facebook cover photo or a restaurant interior shot."
          previewClassName="w-28 h-28 object-cover rounded-md bg-calista-cream"
        />
      </div>

      <PromotionsManager />

      <MenuManager />

      <CustomersSection />
    </div>
  )
}

function BrandSlot({ id, label, hint, previewClassName }) {
  const { overrides, setImage, clearImage } = useImages()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const isCustom = !!overrides[id]
  const preview = overrides[id]

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file.'); return }
    setBusy(true); setErr(null)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      setImage(id, dataUrl)
    } catch { setErr('Could not read that image.') }
    finally { setBusy(false) }
  }

  return (
    <div className="bg-white border border-calista-ink/10 rounded-lg p-3 flex gap-4">
      {preview ? (
        <img src={preview} alt={label} className={previewClassName} />
      ) : (
        <div className={`${previewClassName} flex items-center justify-center text-calista-ink/30 text-xs text-center px-2`}>
          No image
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-calista-ink/50 mb-2">{hint}</div>
        <div className="text-xs mb-3">
          {isCustom ? <span className="text-calista-gold">● Uploaded</span> : <span className="text-calista-ink/40">○ Not set</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="text-xs px-3 py-2 bg-calista-ink text-calista-cream rounded-full hover:bg-calista-gold hover:text-calista-ink transition disabled:opacity-50">
            {busy ? 'Uploading…' : isCustom ? 'Replace' : 'Upload'}
          </button>
          {isCustom && (
            <button onClick={() => clearImage(id)}
              className="text-xs px-3 py-2 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">
              Revert
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        </div>
        {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      </div>
    </div>
  )
}

function MenuManager() {
  const { grouped, addCategory } = useMenu()
  const [newCat, setNewCat] = useState('')

  const submitCategory = (e) => {
    e.preventDefault()
    if (!newCat.trim()) return
    addCategory(newCat)
    setNewCat('')
  }

  return (
    <>
      <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2 flex items-center justify-between">
        <span>Menu</span>
      </h2>
      <form onSubmit={submitCategory} className="flex gap-2 mb-8">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="New category name (e.g. Salads)"
          className="flex-1 px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold"
        />
        <button
          type="submit"
          className="px-5 py-3 bg-calista-ink text-calista-cream rounded-lg font-semibold hover:bg-calista-gold hover:text-calista-ink transition"
        >
          + Add category
        </button>
      </form>

      {grouped.length === 0 && (
        <p className="text-calista-ink/50 mb-8">No categories yet. Add one above to get started.</p>
      )}

      {grouped.map((cat) => (
        <CategoryBlock key={cat.id} category={cat} />
      ))}
    </>
  )
}

function CategoryBlock({ category }) {
  const { renameCategory, deleteCategory } = useMenu()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState(category.name)

  const saveRename = (e) => {
    e.preventDefault()
    renameCategory(category.id, name)
    setEditing(false)
  }
  const onDelete = () => {
    const itemCount = category.items.length
    const msg = itemCount > 0
      ? `Delete "${category.name}" and its ${itemCount} item${itemCount === 1 ? '' : 's'}?`
      : `Delete "${category.name}"?`
    if (confirm(msg)) deleteCategory(category.id)
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-3 mb-4 border-b border-calista-ink/10 pb-2">
        {editing ? (
          <form onSubmit={saveRename} className="flex gap-2 flex-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold"
            />
            <button type="submit" className="px-3 py-2 bg-calista-ink text-calista-cream rounded-lg text-sm">Save</button>
            <button type="button" onClick={() => { setName(category.name); setEditing(false) }} className="px-3 py-2 border border-calista-ink/20 rounded-lg text-sm">Cancel</button>
          </form>
        ) : (
          <h3 className="font-display text-2xl text-calista-gold">{category.name}</h3>
        )}
        {!editing && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold">Rename</button>
            <button onClick={onDelete} className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">Delete</button>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {category.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
        {category.items.length === 0 && !adding && (
          <p className="text-sm text-calista-ink/40 italic sm:col-span-2">No items in this category yet.</p>
        )}
      </div>

      {adding ? (
        <div className="mt-4">
          <ItemForm
            mode="create"
            categoryId={category.id}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 text-sm px-4 py-2 border-2 border-dashed border-calista-ink/20 rounded-lg text-calista-ink/60 hover:border-calista-gold hover:text-calista-gold w-full"
        >
          + Add item to {category.name}
        </button>
      )}
    </section>
  )
}

function ItemCard({ item }) {
  const { getImage } = useImages()
  const { deleteItem } = useMenu()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return <ItemForm mode="edit" item={item} onDone={() => setEditing(false)} />
  }

  const onDelete = () => {
    if (confirm(`Delete "${item.name}"?`)) deleteItem(item.id)
  }

  return (
    <div className="bg-white border border-calista-ink/10 rounded-lg p-3 flex gap-4">
      <img
        src={getImage(item.id, item.image)}
        alt={item.name}
        className="w-24 h-24 object-cover rounded-md bg-calista-cream shrink-0"
        onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="font-semibold truncate">{item.name}</div>
        <div className="text-xs text-calista-ink/60 mt-1 line-clamp-2 mb-2">{item.desc || <span className="italic">No description</span>}</div>
        <div className="font-semibold text-sm mb-3">{formatLKR(item.price)}</div>
        <div className="flex gap-2 mt-auto">
          <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 bg-calista-ink text-calista-cream rounded-full hover:bg-calista-gold hover:text-calista-ink">Edit</button>
          <button onClick={onDelete} className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">Delete</button>
        </div>
      </div>
    </div>
  )
}

function ItemForm({ mode, item, categoryId, onDone }) {
  const { addItem, updateItem, deleteItem } = useMenu()
  const { overrides, setImage, clearImage, getImage } = useImages()
  const fileRef = useRef(null)
  const [form, setForm] = useState(() => ({
    name: item?.name || '',
    desc: item?.desc || '',
    price: item?.price ?? '',
    image: item?.image || ''
  }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const isEdit = mode === 'edit'
  const previewId = isEdit ? item.id : null
  const customPreview = previewId ? overrides[previewId] : null

  const handleField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file.'); return }
    setBusy(true); setErr(null)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      let id = previewId
      if (!isEdit) {
        if (!form.name.trim()) { setErr('Enter a name first, then upload.'); setBusy(false); return }
        id = addItem(categoryId, form)
        if (id) setImage(id, dataUrl)
        onDone()
        return
      }
      setImage(id, dataUrl)
    } catch { setErr('Could not read that image.') }
    finally { setBusy(false) }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setErr('Name is required.'); return }
    if (isEdit) {
      updateItem(item.id, form)
    } else {
      addItem(categoryId, form)
    }
    onDone()
  }

  const onDelete = () => {
    if (isEdit && confirm(`Delete "${item.name}"?`)) {
      deleteItem(item.id)
      onDone()
    }
  }

  return (
    <form onSubmit={submit} className="bg-calista-cream border-2 border-calista-gold/40 rounded-lg p-4 sm:col-span-2">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="shrink-0">
          {previewId ? (
            <img
              src={getImage(previewId, form.image || '')}
              alt=""
              className="w-28 h-28 object-cover rounded-md bg-white"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
            />
          ) : form.image ? (
            <img src={form.image} alt="" className="w-28 h-28 object-cover rounded-md bg-white" />
          ) : (
            <div className="w-28 h-28 rounded-md bg-white flex items-center justify-center text-calista-ink/30 text-xs text-center px-2">
              No image
            </div>
          )}
          <div className="flex flex-col gap-1 mt-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="text-xs px-3 py-1.5 bg-calista-ink text-calista-cream rounded-full disabled:opacity-50"
            >
              {busy ? 'Uploading…' : customPreview ? 'Replace upload' : 'Upload image'}
            </button>
            {isEdit && customPreview && (
              <button
                type="button"
                onClick={() => clearImage(previewId)}
                className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600"
              >
                Use URL/default
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <Field label="Name" value={form.name} onChange={handleField('name')} required placeholder="e.g. Wood-Fired Margherita" />
          <Field label="Description" value={form.desc} onChange={handleField('desc')} textarea placeholder="Short, appetising description" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Price (LKR)" type="number" min="0" step="50" value={form.price} onChange={handleField('price')} required />
            <Field label="Image URL (optional fallback)" value={form.image} onChange={handleField('image')} placeholder="https://…" />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-calista-ink text-calista-cream rounded-full text-sm font-semibold">
              {isEdit ? 'Save changes' : 'Add item'}
            </button>
            <button type="button" onClick={onDone} className="px-4 py-2 border border-calista-ink/20 rounded-full text-sm">
              Cancel
            </button>
            {isEdit && (
              <button type="button" onClick={onDelete} className="px-4 py-2 border border-calista-ink/20 rounded-full text-sm hover:border-red-500 hover:text-red-600 ml-auto">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

function Field({ label, value, onChange, type = 'text', required, textarea, placeholder, min, step }) {
  const common = {
    value,
    onChange,
    required,
    placeholder,
    className: 'w-full px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm'
  }
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1 text-calista-ink/70">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {textarea
        ? <textarea rows={2} {...common} />
        : <input type={type} min={min} step={step} {...common} />}
    </label>
  )
}

function PromotionsManager() {
  const { items, resetToDefault } = usePromotions()
  const [adding, setAdding] = useState(false)

  const sorted = [...items].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))

  const handleReset = () => {
    if (confirm('Reset promotions back to the sample data? Your edits will be lost.')) resetToDefault()
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between gap-3 mb-4 border-b border-calista-ink/10 pb-2">
        <h2 className="font-display text-2xl text-calista-gold">Promotions</h2>
        <button
          onClick={handleReset}
          className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold"
        >
          Reset to samples
        </button>
      </div>

      <div className="space-y-4">
        {sorted.map((p) => (
          <PromoCard key={p.id} promo={p} />
        ))}
        {sorted.length === 0 && !adding && (
          <p className="text-sm text-calista-ink/40 italic">No promotions yet.</p>
        )}
      </div>

      {adding ? (
        <div className="mt-4">
          <PromoForm mode="create" onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 text-sm px-4 py-2 border-2 border-dashed border-calista-ink/20 rounded-lg text-calista-ink/60 hover:border-calista-gold hover:text-calista-gold w-full"
        >
          + Add promotion
        </button>
      )}
    </section>
  )
}

function PromoCard({ promo }) {
  const { getImage } = useImages()
  const { remove } = usePromotions()
  const [editing, setEditing] = useState(false)
  const status = statusOf(promo)

  if (editing) return <PromoForm mode="edit" promo={promo} onDone={() => setEditing(false)} />

  const onDelete = () => {
    if (confirm(`Delete promotion "${promo.title}"?`)) remove(promo.id)
  }

  const statusStyles = {
    active: 'bg-calista-gold text-calista-ink',
    upcoming: 'bg-calista-ink text-calista-cream',
    past: 'bg-calista-ink/20 text-calista-ink/60'
  }
  const statusLabel = { active: 'On now', upcoming: 'Coming soon', past: 'Ended' }

  return (
    <div className="bg-white border border-calista-ink/10 rounded-lg p-3 flex gap-4">
      <img
        src={getImage(promo.id, promo.image)}
        alt={promo.title}
        className="w-28 h-28 object-cover rounded-md bg-calista-cream shrink-0"
        onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold truncate">{promo.title}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusStyles[status]}`}>
            {statusLabel[status]}
          </span>
        </div>
        <div className="text-xs text-calista-gold font-semibold mb-1">
          {formatDateRange(promo.startDate, promo.endDate) || <span className="text-calista-ink/40 font-normal">No dates set</span>}
        </div>
        <p className="text-xs text-calista-ink/60 line-clamp-2 mb-3">{promo.description || <span className="italic">No description</span>}</p>
        <div className="flex gap-2 mt-auto flex-wrap">
          <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 bg-calista-ink text-calista-cream rounded-full hover:bg-calista-gold hover:text-calista-ink">Edit</button>
          <button onClick={onDelete} className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">Delete</button>
          {promo.url && (
            <a href={promo.url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-calista-gold">
              Open link ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function PromoForm({ mode, promo, onDone }) {
  const { add, update, remove } = usePromotions()
  const { overrides, setImage, clearImage, getImage } = useImages()
  const fileRef = useRef(null)
  const [form, setForm] = useState(() => ({
    title: promo?.title || '',
    description: promo?.description || '',
    image: promo?.image || '',
    startDate: promo?.startDate || '',
    endDate: promo?.endDate || '',
    url: promo?.url || ''
  }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const isEdit = mode === 'edit'
  const previewId = isEdit ? promo.id : null
  const customPreview = previewId ? overrides[previewId] : null

  const handleField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file.'); return }
    setBusy(true); setErr(null)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      if (!isEdit) {
        if (!form.title.trim()) { setErr('Enter a title first, then upload.'); setBusy(false); return }
        const id = add(form)
        if (id) setImage(id, dataUrl)
        onDone()
        return
      }
      setImage(previewId, dataUrl)
    } catch { setErr('Could not read that image.') }
    finally { setBusy(false) }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setErr('Title is required.'); return }
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setErr('End date must be on or after the start date.')
      return
    }
    if (isEdit) update(promo.id, form)
    else add(form)
    onDone()
  }

  const onDelete = () => {
    if (isEdit && confirm(`Delete promotion "${promo.title}"?`)) {
      remove(promo.id)
      onDone()
    }
  }

  return (
    <form onSubmit={submit} className="bg-calista-cream border-2 border-calista-gold/40 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="shrink-0">
          {previewId ? (
            <img
              src={getImage(previewId, form.image || '')}
              alt=""
              className="w-28 h-28 object-cover rounded-md bg-white"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
            />
          ) : form.image ? (
            <img src={form.image} alt="" className="w-28 h-28 object-cover rounded-md bg-white" />
          ) : (
            <div className="w-28 h-28 rounded-md bg-white flex items-center justify-center text-calista-ink/30 text-xs text-center px-2">
              No image
            </div>
          )}
          <div className="flex flex-col gap-1 mt-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="text-xs px-3 py-1.5 bg-calista-ink text-calista-cream rounded-full disabled:opacity-50">
              {busy ? 'Uploading…' : customPreview ? 'Replace upload' : 'Upload image'}
            </button>
            {isEdit && customPreview && (
              <button type="button" onClick={() => clearImage(previewId)}
                className="text-xs px-3 py-1.5 border border-calista-ink/20 rounded-full hover:border-red-500 hover:text-red-600">
                Use URL/default
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <Field label="Title" value={form.title} onChange={handleField('title')} required placeholder="e.g. Aperitivo Hour" />
          <Field label="Description" value={form.description} onChange={handleField('description')} textarea placeholder="Short, appetising description — what, when, how much" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Start date" type="date" value={form.startDate} onChange={handleField('startDate')} required />
            <Field label="End date" type="date" value={form.endDate} onChange={handleField('endDate')} required />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Image URL (optional fallback)" value={form.image} onChange={handleField('image')} placeholder="https://…" />
            <Field label="Link URL (FB post, booking page)" value={form.url} onChange={handleField('url')} placeholder="https://facebook.com/…" />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-calista-ink text-calista-cream rounded-full text-sm font-semibold">
              {isEdit ? 'Save changes' : 'Add promotion'}
            </button>
            <button type="button" onClick={onDone} className="px-4 py-2 border border-calista-ink/20 rounded-full text-sm">
              Cancel
            </button>
            {isEdit && (
              <button type="button" onClick={onDelete} className="px-4 py-2 border border-calista-ink/20 rounded-full text-sm hover:border-red-500 hover:text-red-600 ml-auto">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

function SettingsSection() {
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2">
        Settings
      </h2>
      <ServiceChargeEditor />
      <LoyaltyTiersEditor />
    </section>
  )
}

function ServiceChargeEditor() {
  const { serviceChargePercent, update } = useSettings()
  const [value, setValue] = useState(String(serviceChargePercent))
  const [saved, setSaved] = useState(false)

  const onSave = (e) => {
    e.preventDefault()
    const n = Math.max(0, Math.min(100, Number(value) || 0))
    update({ serviceChargePercent: n })
    setValue(String(n))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <form
      onSubmit={onSave}
      className="bg-white border border-calista-ink/10 rounded-lg p-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end mb-4"
    >
      <label className="block">
        <span className="text-sm font-medium block mb-1">
          Service charge (%)
          <span className="text-calista-ink/50 font-normal ml-2 text-xs">
            Applied to table (QR) orders only. Set 0 to disable.
          </span>
        </span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false) }}
          className="w-full px-4 py-3 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white"
        />
      </label>
      <button
        type="submit"
        className="px-5 py-3 bg-calista-ink text-calista-cream rounded-lg font-semibold hover:bg-calista-gold hover:text-calista-ink transition"
      >
        {saved ? "Saved ✓" : "Save"}
      </button>
    </form>
  )
}

function LoyaltyTiersEditor() {
  const { loyaltyTiers, update, resetTiers } = useSettings()
  const [tiers, setTiers] = useState(loyaltyTiers)
  const [saved, setSaved] = useState(false)

  const onChange = (idx, field, val) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t)))
    setSaved(false)
  }

  const onSave = (e) => {
    e.preventDefault()
    const cleaned = tiers.map((t) => ({
      name: t.name.trim() || 'Tier',
      minVisits: Math.max(0, Number(t.minVisits) || 0),
      discountPercent: Math.max(0, Math.min(100, Number(t.discountPercent) || 0))
    })).sort((a, b) => a.minVisits - b.minVisits)
    update({ loyaltyTiers: cleaned })
    setTiers(cleaned)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const onReset = () => {
    resetTiers()
    setTiers([
      { name: 'New', minVisits: 0, discountPercent: 0 },
      { name: 'Returning', minVisits: 1, discountPercent: 5 },
      { name: 'Regular', minVisits: 5, discountPercent: 10 },
      { name: 'VIP', minVisits: 15, discountPercent: 15 }
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <form onSubmit={onSave} className="bg-white border border-calista-ink/10 rounded-lg p-4">
      <div className="mb-3">
        <span className="text-sm font-medium block">Loyalty tiers</span>
        <span className="text-xs text-calista-ink/50">
          Discount applied to table orders based on how many times the customer has visited before.
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_140px_140px] gap-2 mb-3 text-xs text-calista-ink/60 font-medium uppercase tracking-wider">
        <span>Tier name</span>
        <span>Min visits</span>
        <span>Discount %</span>
      </div>
      <div className="space-y-2">
        {tiers.map((tier, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_140px_140px] gap-2">
            <input
              type="text"
              value={tier.name}
              onChange={(e) => onChange(idx, 'name', e.target.value)}
              className="px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm"
            />
            <input
              type="number"
              min="0"
              value={tier.minVisits}
              onChange={(e) => onChange(idx, 'minVisits', e.target.value)}
              className="w-20 sm:w-full px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm text-right"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={tier.discountPercent}
              onChange={(e) => onChange(idx, 'discountPercent', e.target.value)}
              className="w-20 sm:w-full px-3 py-2 border border-calista-ink/20 rounded-lg focus:outline-none focus:border-calista-gold bg-white text-sm text-right"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          className="px-5 py-2 bg-calista-ink text-calista-cream rounded-full text-sm font-semibold hover:bg-calista-gold hover:text-calista-ink transition"
        >
          {saved ? 'Saved ✓' : 'Save tiers'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-5 py-2 border border-calista-ink/20 rounded-full text-sm hover:border-calista-gold"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  )
}

function CustomersSection() {
  const { list, remove } = useCustomers()
  const { loyaltyTiers } = useSettings()

  const sorted = [...list].sort((a, b) =>
    (b.lastSeen || '').localeCompare(a.lastSeen || '')
  )

  const onDelete = (c) => {
    if (confirm(`Delete customer ${c.name} (${c.phone})?`)) remove(c.phone)
  }

  const fmtDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl text-calista-gold mb-4 border-b border-calista-ink/10 pb-2">
        Customers ({list.length})
      </h2>

      {list.length === 0 ? (
        <div className="bg-white border border-calista-ink/10 rounded-lg p-6 text-center text-calista-ink/60">
          No customers yet. They'll appear here when guests sign in at a table via QR code.
        </div>
      ) : (
        <div className="bg-white border border-calista-ink/10 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-calista-cream/50 text-xs uppercase tracking-wider text-calista-ink/60">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-right p-3">Visits</th>
                <th className="text-right p-3">Spent</th>
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Last seen</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((c) => {
                const tier = getTier(c.visits, loyaltyTiers)
                return (
                  <tr key={c.phone}>
                    <td className="p-3 font-semibold">{c.name}</td>
                    <td className="p-3 text-calista-ink/70">{c.phone}</td>
                    <td className="p-3 text-right">{c.visits}</td>
                    <td className="p-3 text-right">{formatLKR(c.totalSpent || 0)}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-calista-gold/10 text-calista-ink border border-calista-gold/30">
                        {tier.name} · {tier.discountPercent}%
                      </span>
                    </td>
                    <td className="p-3 text-calista-ink/70">{fmtDate(c.lastSeen)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onDelete(c)}
                        className="text-calista-ink/40 hover:text-red-600 p-1"
                        aria-label="Delete"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
