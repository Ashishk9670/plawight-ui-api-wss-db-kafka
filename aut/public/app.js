const $ = (id) => document.getElementById(id);
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  cart: [],
  products: [],
  ws: null,
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.error || 'Request failed');
  return body;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 4000);
}

function render() {
  const loggedIn = Boolean(state.token);
  $('login-view').hidden = loggedIn;
  $('shop-view').hidden = !loggedIn;
  $('user-area').hidden = !loggedIn;
  if (loggedIn) document.querySelector('[data-testid="user-name"]').textContent = state.user.name;
}

async function loadProducts() {
  const search = $('search').value.trim();
  state.products = await api(`/api/products${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  $('product-list').innerHTML = '';
  for (const p of state.products) {
    const li = document.createElement('li');
    li.dataset.testid = `product-${p.id}`;
    const nameEl = document.createElement('span');
    nameEl.dataset.testid = 'product-name';
    nameEl.textContent = p.name;
    const priceEl = document.createElement('span');
    priceEl.dataset.testid = 'product-price';
    priceEl.textContent = p.price.toFixed(2);
    li.append(nameEl, priceEl);
    const btn = document.createElement('button');
    btn.textContent = 'Add';
    btn.dataset.testid = `add-to-cart-${p.id}`;
    btn.onclick = () => addToCart(p);
    li.appendChild(btn);
    $('product-list').appendChild(li);
  }
}

function addToCart(p) {
  const line = state.cart.find((l) => l.productId === p.id);
  if (line) line.quantity += 1;
  else state.cart.push({ productId: p.id, name: p.name, price: p.price, quantity: 1 });
  renderCart();
}

function renderCart() {
  $('cart-list').innerHTML = '';
  let total = 0;
  for (const l of state.cart) {
    total += l.price * l.quantity;
    const li = document.createElement('li');
    li.dataset.testid = `cart-item-${l.productId}`;
    li.textContent = `${l.name} x ${l.quantity}`;
    $('cart-list').appendChild(li);
  }
  $('cart-total').textContent = total.toFixed(2);
}

async function loadOrders() {
  const list = await api('/api/orders');
  $('orders-body').innerHTML = list
    .map(
      (o) =>
        `<tr data-testid="order-row-${o.id}"><td data-testid="order-id">${o.id}</td><td>${o.total.toFixed(2)}</td><td data-testid="order-status">${o.status}</td></tr>`,
    )
    .join('');
}

let reconnectTimer;

function connectWs() {
  clearTimeout(reconnectTimer);
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${proto}://${location.host}/ws?token=${state.token}`);
  state.ws = socket;
  window.shopSocket = socket; // exposed so tests can drop the connection
  socket.onopen = () => {
    // Pushes sent while disconnected are not replayed, so resync the list after a reconnect.
    if (state.hadSocket) loadOrders();
    state.hadSocket = true;
  };
  socket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'order.status') {
      toast(`Order #${msg.orderId} is ${msg.status}`);
      loadOrders();
    }
  };
  socket.onclose = () => {
    // Reconnect only while logged in and only if this socket is still the current one.
    if (state.token && state.ws === socket) reconnectTimer = setTimeout(connectWs, 1000);
  };
}

async function enterShop() {
  render();
  await Promise.all([loadProducts(), loadOrders()]);
  connectWs();
}

$('login-form').onsubmit = async (e) => {
  e.preventDefault();
  $('login-error').hidden = true;
  const form = new FormData(e.target);
  try {
    const { token, user } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    Object.assign(state, { token, user });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    await enterShop();
  } catch (err) {
    $('login-error').textContent = err.message;
    $('login-error').hidden = false;
  }
};

$('logout').onclick = () => {
  localStorage.clear();
  clearTimeout(reconnectTimer);
  state.ws?.close();
  Object.assign(state, { token: null, user: null, cart: [], hadSocket: false });
  renderCart();
  render();
};

$('search').oninput = () => loadProducts();

$('place-order').onclick = async () => {
  if (!state.cart.length) return toast('Cart is empty');
  try {
    const order = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items: state.cart.map(({ productId, quantity }) => ({ productId, quantity })) }),
    });
    state.cart = [];
    renderCart();
    toast(`Order #${order.id} placed`);
    await loadOrders();
  } catch (err) {
    toast(err.message);
  }
};

state.token ? enterShop().catch(() => $('logout').click()) : render();
