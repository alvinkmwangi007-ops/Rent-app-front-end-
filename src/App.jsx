import React, { useEffect, useRef, useState } from 'react';
import { API } from '../api.js';

const KES = (amount) => `KES ${Math.round(amount).toLocaleString('en-KE')}`;
const paid = (tenant) => (tenant.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
const balance = (tenant) => tenant.rent - paid(tenant);
const status = (tenant) => balance(tenant) <= 0 ? ['Paid', 'ok'] : paid(tenant) > 0 ? ['Partial', 'part'] : ['Unpaid', 'due'];
const normalizePhone = (value) => `254${String(value).replace(/\D/g, '').replace(/^(254|0)/, '')}`;
const isKenyanPhone = (phone) => /^254[17]\d{8}$/.test(phone);

function Field({ label, value, onChange, type = 'text', ...props }) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function PhoneField({ value, onChange }) {
  return (
    <label>
      Phone number
      <div className="phone-field">
        <span>254</span>
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          placeholder="712 345 678"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function TenantForm({ mode, initial = {}, onSave, onCancel }) {
  const [fields, setFields] = useState({
    name: initial.name || '',
    phone: initial.phone ? String(initial.phone).replace(/\D/g, '').replace(/^(254|0)/, '') : '',
    unit: initial.unit || '',
    rent: initial.rent ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key) => (value) => setFields((current) => ({ ...current, [key]: value }));
  const addMode = mode === 'add';

  async function submit(event) {
    event.preventDefault();
    setError('');
    const name = fields.name.trim();
    const phone = normalizePhone(fields.phone);
    const rent = Number(String(fields.rent).replace(/[ ,]/g, ''));
    if (!name) setError("Enter the tenant's name.");
    else if (!isKenyanPhone(phone)) setError('Enter a valid Kenyan mobile number, such as 0712 345 678.');
    else if (!addMode && !/^[A-Za-z0-9-]{1,12}$/.test(fields.unit.trim())) setError('Unit can use letters, digits and dashes (up to 12 characters).');
    else if (!addMode && (!Number.isInteger(rent) || rent <= 0)) setError('Monthly rent must be a whole number greater than zero.');
    else {
      setSaving(true);
      try {
        await onSave(addMode ? { name, phone } : { name, phone, unit: fields.unit.trim(), rent });
      } catch (saveError) {
        setError(saveError.message || 'Could not save tenant details.');
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <section className="sec tenant-form">
      <h2>{addMode ? 'Add tenant' : `Edit ${initial.name}`}</h2>
      {error && <p className="err" role="alert">{error}</p>}
      <form onSubmit={submit}>
        <Field label="Name" value={fields.name} onChange={update('name')} autoComplete="name" />
        <PhoneField value={fields.phone} onChange={update('phone')} />
        {!addMode && <>
          <Field label="Unit (M-Pesa account number)" value={fields.unit} onChange={update('unit')} />
          <Field label="Monthly rent (KES)" type="number" min="1" step="1" value={fields.rent} onChange={update('rent')} />
        </>}
        <div className="form-actions">
          <button className="pri" type="submit" disabled={saving}>{saving ? 'Saving…' : addMode ? 'Save tenant' : 'Save changes'}</button>
          <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

function TenantRow({ tenant, flash, onSelect }) {
  const [label, className] = status(tenant);
  const percentage = Math.min(100, paid(tenant) / tenant.rent * 100);
  return (
    <div className={`row ${flash ? 'flash' : ''}`} role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(); }}>
      <div><div className="nm">{tenant.name}</div><div className="sm">Unit {tenant.unit}</div></div>
      <div className="bw"><div className="bar"><i style={{ width: `${percentage}%` }} /></div><div className="sm">{KES(paid(tenant))} of {KES(tenant.rent)}</div></div>
      <span className={`tag ${className}`}>{label}</span>
    </div>
  );
}

function YearChart({ tenant, labels }) {
  const width = 600, height = 230, left = 46, bottom = 26;
  const values = [...(tenant.history || []), paid(tenant)];
  const max = Math.max(tenant.rent, ...values) * 1.1;
  const barWidth = (width - left) / 12;
  const y = (value) => height - bottom - (height - bottom - 12) * value / max;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rent paid each month over the past year">
      {[0, 0.5, 1].map((portion) => <text key={portion} className="svgt" x={left - 6} y={y(tenant.rent * portion) + 4} textAnchor="end">{tenant.rent * portion / 1000}k</text>)}
      {values.map((value, index) => {
        const x = left + index * barWidth + barWidth * 0.18;
        const color = value >= tenant.rent ? 'var(--green)' : value > 0 ? 'var(--amber)' : 'var(--red)';
        return <g key={index}><rect x={x} y={y(value)} width={barWidth * 0.64} height={height - bottom - y(value)} rx="3" fill={color} /><text className="svgt" x={x + barWidth * 0.32} y={height - 8} textAnchor="middle">{labels[index]}</text></g>;
      })}
      <line x1={left} x2={width} y1={y(tenant.rent)} y2={y(tenant.rent)} stroke="var(--ink)" strokeDasharray="4 4" opacity=".5" />
    </svg>
  );
}

function MonthChart({ tenant, overview }) {
  const width = 600, height = 230, left = 46, bottom = 26;
  const max = tenant.rent * 1.1;
  const x = (day) => left + (width - left - 8) * day / overview.daysInMonth;
  const y = (value) => height - bottom - (height - bottom - 12) * value / max;
  let cumulative = 0;
  const points = [`${x(0)},${y(0)}`];
  [...(tenant.payments || [])].sort((a, b) => a.day - b.day).forEach((payment) => {
    points.push(`${x(payment.day)},${y(cumulative)}`);
    cumulative += payment.amount;
    points.push(`${x(payment.day)},${y(cumulative)}`);
  });
  points.push(`${x(overview.today)},${y(cumulative)}`);
  const pointString = points.join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cumulative rent paid this month">
      {[0, 0.5, 1].map((portion) => <text key={portion} className="svgt" x={left - 6} y={y(tenant.rent * portion) + 4} textAnchor="end">{tenant.rent * portion / 1000}k</text>)}
      {[1, 10, 20, overview.daysInMonth].map((day) => <text key={day} className="svgt" x={x(day)} y={height - 8} textAnchor="middle">{day}</text>)}
      <line x1={left} x2={width - 8} y1={y(tenant.rent)} y2={y(tenant.rent)} stroke="var(--ink)" strokeDasharray="4 4" opacity=".5" />
      <polygon points={`${pointString} ${x(overview.today)},${y(0)}`} fill="var(--green)" opacity=".15" />
      <polyline points={pointString} fill="none" stroke="var(--green)" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [overview, setOverview] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('year');
  const [feed, setFeed] = useState([]);
  const [flashId, setFlashId] = useState(null);
  const [addingTenant, setAddingTenant] = useState(false);
  const [editingTenant, setEditingTenant] = useState(false);
  const [toast, setToast] = useState('');
  const [loginError, setLoginError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const overviewRef = useRef(null);
  const stopRef = useRef(null);
  const toastTimer = useRef(null);
  const flashTimer = useRef(null);

  function updateOverview(value) {
    overviewRef.current = value;
    setOverview(value);
  }

  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }

  function handleAuthLost(error) {
    stopRef.current?.();
    stopRef.current = null;
    updateOverview(null);
    setAuthenticated(false);
    setSelectedId(null);
    setAddingTenant(false);
    setEditingTenant(false);
    setLoginError(error.message);
    API.logout();
  }

  function handlePayment(event) {
    const current = overviewRef.current;
    const tenant = current?.tenants.find((item) => item.id === event.tenantId);
    if (!tenant) return;
    if (event.id && tenant.payments?.some((payment) => payment.__id === event.id)) return;
    const next = {
      ...current,
      tenants: current.tenants.map((item) => item.id === tenant.id
        ? { ...item, payments: [...(item.payments || []), { day: event.day, amount: event.amount, __id: event.id }] }
        : item),
    };
    updateOverview(next);
    setFeed((items) => [`${event.time} - ${tenant.name} (${tenant.unit}) paid ${KES(event.amount)}`, ...items].slice(0, 5));
    setFlashId(tenant.id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 2000);
    showToast(`M-Pesa: ${KES(event.amount)} from ${tenant.name}`);
  }

  useEffect(() => () => {
    stopRef.current?.();
    clearTimeout(toastTimer.current);
    clearTimeout(flashTimer.current);
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setLoginError('');
    try {
      await API.login(username.trim(), password);
      const data = await API.getOverview();
      updateOverview(data);
      setAuthenticated(true);
      stopRef.current = API.onPayment(handlePayment, handleAuthLost);
      setPassword('');
    } catch (error) {
      setLoginError(error.message);
    }
  }

  async function signOut() {
    stopRef.current?.();
    stopRef.current = null;
    updateOverview(null);
    setAuthenticated(false);
    setSelectedId(null);
    setFeed([]);
    setAddingTenant(false);
    setEditingTenant(false);
    await API.logout();
  }

  async function saveNewTenant(fields) {
    try {
      await API.addTenant(fields.name, fields.phone);
      updateOverview(await API.getOverview());
      setAddingTenant(false);
      showToast('Tenant added.');
    } catch (error) {
      if (API.isAuthError(error)) handleAuthLost(error);
      throw error;
    }
  }

  async function saveTenantChanges(tenantId, fields) {
    try {
      await API.updateTenant(tenantId, fields);
      updateOverview(await API.getOverview());
      setEditingTenant(false);
      showToast('Changes saved.');
    } catch (error) {
      if (API.isAuthError(error)) handleAuthLost(error);
      throw error;
    }
  }

  async function remindTenant(tenant) {
    try {
      await API.remindTenant(tenant.id);
      showToast(`Reminder sent to ${tenant.name} (${tenant.phone}) for ${KES(Math.max(balance(tenant), 0))}.`);
    } catch (error) {
      if (API.isAuthError(error)) handleAuthLost(error);
      else showToast(`Could not send reminder: ${error.message}`);
    }
  }

  if (!authenticated) {
    return (
      <>
        <main id="app"><div className="login"><h1>Rent Desk</h1><p className="sm">Manager sign in</p>
          {loginError && <p className="err" role="alert">{loginError}</p>}
          <form onSubmit={signIn}>
            <Field label="Username" value={username} onChange={setUsername} autoComplete="username" />
            <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
            <button className="pri" type="submit">Sign in</button>
          </form>
        </div></main>
        {toast && <div className="toast" role="status">{toast}</div>}
      </>
    );
  }

  const tenant = selectedId === null ? null : overview.tenants.find((item) => item.id === selectedId);
  const tenants = overview.tenants;
  const totalPaid = tenants.reduce((sum, item) => sum + paid(item), 0);
  const totalRent = tenants.reduce((sum, item) => sum + item.rent, 0);
  const fullyPaid = tenants.filter((item) => balance(item) <= 0).length;

  return (
    <>
      <main id="app">
        <header className="top"><h1>Rent Desk</h1><div className="header-actions"><span className="live"><i className="dot" />Live</span><button onClick={signOut}>Sign out</button></div></header>
        {tenant ? <>
          <button onClick={() => { setSelectedId(null); setEditingTenant(false); }}>Back to tenants</button>
          <section className="sec profile-heading"><div className="top profile-top"><div><h2>{tenant.name}</h2><div className="sm">Unit {tenant.unit} · {tenant.phone}</div></div><StatusTag tenant={tenant} /></div></section>
          <div className="stats"><div><b>{KES(paid(tenant))}</b><span>Paid this month</span></div><div><b>{KES(Math.max(balance(tenant), 0))}</b><span>Balance</span></div><div><b>{KES(tenant.rent)}</b><span>Monthly rent</span></div></div>
          <section className="sec"><div className="top chart-head"><h2>{mode === 'year' ? 'Payments over the year' : 'Payments this month'}</h2><div className="tog"><button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>Month</button><button className={mode === 'year' ? 'on' : ''} onClick={() => setMode('year')}>Year</button></div></div>
            {mode === 'year' ? <YearChart tenant={tenant} labels={overview.labels} /> : <MonthChart tenant={tenant} overview={overview} />}
          </section>
          {editingTenant ? <TenantForm key={tenant.id} mode="edit" initial={tenant} onSave={(fields) => saveTenantChanges(tenant.id, fields)} onCancel={() => setEditingTenant(false)} /> : <div className="form-actions"><button className="pri" disabled={balance(tenant) <= 0} onClick={() => remindTenant(tenant)}>Remind tenant</button><button onClick={() => setEditingTenant(true)}>Edit details</button></div>}
        </> : <>
          <div className="stats"><div><b>{KES(totalPaid)}</b><span>Collected in {overview.month}</span></div><div><b>{KES(totalRent - totalPaid)}</b><span>Outstanding</span></div><div><b>{fullyPaid}/{tenants.length}</b><span>Tenants fully paid</span></div></div>
          <section className="sec"><div className="bar"><i style={{ width: `${totalRent ? totalPaid / totalRent * 100 : 0}%` }} /></div></section>
          <section className="sec feed"><h2>Live payments</h2>{feed.length ? feed.map((message, index) => <p key={`${index}-${message}`}>{message}</p>) : <p className="sm">Waiting for the next M-Pesa payment.</p>}</section>
          {addingTenant && <TenantForm mode="add" onSave={saveNewTenant} onCancel={() => setAddingTenant(false)} />}
          <section className="sec"><div className="top tenants-head"><h2>Tenants</h2><button className="pri" onClick={() => setAddingTenant(true)}>Add tenant</button></div>
            {[...tenants].sort((a, b) => balance(b) - balance(a)).map((item) => <TenantRow key={item.id} tenant={item} flash={flashId === item.id} onSelect={() => { setSelectedId(item.id); setMode('year'); }} />)}
          </section>
        </>}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function StatusTag({ tenant }) {
  const [label, className] = status(tenant);
  return <span className={`tag ${className}`}>{label}</span>;
}