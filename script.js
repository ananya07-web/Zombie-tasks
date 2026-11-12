const $ = id => document.getElementById(id);
const milestones = { buddy: 50, theme: 100, badge: 200 };
const rewardNames = { buddy: 'Zombie Buddy', theme: 'Haunted Theme', badge: 'Survivor Badge' };
const icons = { buddy: '🧟', theme: '🏚️', badge: '💀' };

// Keep the same storage keys so existing progress is not lost.
let tasks = readStore('tasks', []);
let score = Number(localStorage.getItem('score') || 0);
let coins = Number(localStorage.getItem('coins') || 0);
let claimed = readStore('claimedRewards', []);
let selectedReward = '';
const reminded = new Set();
const expired = new Set();

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function save() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
  localStorage.setItem('score', String(score));
  localStorage.setItem('coins', String(coins));
  localStorage.setItem('claimedRewards', JSON.stringify(claimed));
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('toast').classList.remove('show'), 2800);
}
function sound() {
  if (!$('sound-toggle').checked) return;
  try {
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.frequency.value = 520;
    gain.gain.value = .045;
    oscillator.start(); oscillator.stop(audio.currentTime + .2);
    oscillator.onended = () => audio.close();
  } catch {}
}
function update() {
  $('score').textContent = `${score} XP`;
  $('coins').textContent = coins;
  $('level').textContent = Math.floor(score / 100) + 1;

  const next = score < 50 ? 50 : score < 100 ? 100 : score < 200 ? 200 : Math.ceil((score + 1) / 100) * 100;
  const previous = next === 50 ? 0 : next === 100 ? 50 : next === 200 ? 100 : next - 100;
  $('xp-count').textContent = `${score} / ${next} XP`;
  $('xp-progress').style.width = `${Math.max(0, Math.min(100, (score - previous) / (next - previous) * 100))}%`;

  const nextReward = Object.keys(milestones).find(key => !claimed.includes(key));
  $('xp-message').textContent = nextReward
    ? `${Math.max(0, milestones[nextReward] - score)} XP to unlock ${rewardNames[nextReward]}.`
    : 'All rewards claimed. Keep earning XP!';

  Object.keys(milestones).forEach(key => {
    const unlocked = score >= milestones[key];
    const owned = claimed.includes(key);
    document.querySelector(`[data-reward="${key}"]`).classList.toggle('unlocked', unlocked || owned);
    $(`status-${key}`).textContent = owned ? '✓ CLAIMED' : unlocked ? '✨ UNLOCKED — CLAIM' : '🔒 LOCKED';
  });

  // Apply the theme on load and immediately after claiming it.
  document.body.classList.toggle('haunted', claimed.includes('theme'));
  if (claimed.includes('buddy')) $('buddy-message').textContent = 'Your Zombie Buddy is here. Let’s defeat those missions!';
}
$('zombie-companion').hidden = !claimed.includes('buddy');
function formatDue(due) {
  const date = new Date(due);
  return Number.isNaN(date.getTime()) ? 'Invalid deadline' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
function render() {
  $('task-list').innerHTML = '';
  $('empty').hidden = tasks.length > 0;
  tasks.forEach(task => {
    const isOverdue = !task.done && new Date(task.due).getTime() <= Date.now();
    const item = document.createElement('article');
    item.className = `task${task.done ? ' done' : ''}${isOverdue ? ' overdue' : ''}`;

    const check = document.createElement('input');
    check.type = 'checkbox'; check.checked = Boolean(task.done);
    check.setAttribute('aria-label', 'Complete mission');
    check.addEventListener('change', () => completeTask(task.id));

    const details = document.createElement('div');
    const name = document.createElement('div'); name.className = 'task-name'; name.textContent = task.name;
    const time = document.createElement('div'); time.className = 'task-time'; time.textContent = formatDue(task.due);
    details.append(name, time);

    const status = document.createElement('span'); status.className = 'task-status';
    status.textContent = task.done ? 'DONE' : isOverdue ? '🧟 ZOMBIE' : '';

    const del = document.createElement('button'); del.className = 'delete-task'; del.textContent = '×';
    del.setAttribute('aria-label', 'Delete mission');
    del.addEventListener('click', () => {
      tasks = tasks.filter(item => item.id !== task.id);
      save(); render(); toast('Mission removed.');
    });
    item.append(check, details, status, del);
    $('task-list').append(item);
  });
}
function completeTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task || task.done) return;
  const late = new Date(task.due).getTime() <= Date.now();
  task.done = true;
  score += late ? 10 : 5;
  coins += late ? 3 : 2;
  save(); update(); render(); sound();
  toast(late ? '+10 XP and 3 coins — zombie defeated!' : '+5 XP and 2 coins — mission complete!');
}
function checkDeadlines() {
  const now = Date.now();
  let needsRender = false;
  tasks.forEach(task => {
    if (task.done) return;
    const due = new Date(task.due).getTime();
    if (!Number.isFinite(due)) return;

    if (due <= now && !expired.has(task.id)) {
      expired.add(task.id);
      needsRender = true;
      toast(`🧟 Deadline passed: ${task.name}`);
      sound();
      sendNotification('Mission turned into a zombie!', `${task.name} is now overdue.`);
    } else if (due - now <= 10 * 60 * 1000 && due > now && !reminded.has(task.id)) {
      reminded.add(task.id);
      toast(`⏰ Deadline in 10 minutes: ${task.name}`);
      sound();
      sendNotification('Deadline approaching', `${task.name} is due in 10 minutes.`);
    }
  });
  if (needsRender) render();
}
function sendNotification(title, message) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body: message }); } catch {}
  }
}

$('task-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('task-input').value.trim();
  const due = $('task-due').value;
  if (!name || !due) return;
  const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random());
  tasks.unshift({ id, name, due, done: false });
  $('task-form').reset();
  save(); render(); checkDeadlines();
  toast('Mission added. Stay alert, survivor!');
});

document.querySelectorAll('.reward').forEach(card => card.addEventListener('click', () => {
  const key = card.dataset.reward;
  selectedReward = key;
  const unlocked = score >= milestones[key];
  const owned = claimed.includes(key);
  $('modal-icon').textContent = icons[key];
  $('modal-title').textContent = owned ? 'Already claimed!' : unlocked ? 'Reward unlocked!' : 'Reward locked';
  $('modal-message').textContent = owned ? 'You already own this reward.' : unlocked ? `Claim your ${rewardNames[key]} reward!` : `Earn ${milestones[key] - score} more XP to unlock this reward.`;
  $('claim-button').hidden = !unlocked || owned;
  $('reward-modal').classList.add('show');
}));
$('claim-button').addEventListener('click', () => {
  if (!selectedReward || claimed.includes(selectedReward) || score < milestones[selectedReward]) return;
  claimed.push(selectedReward);
  save(); update(); $('reward-modal').classList.remove('show');
  toast(selectedReward === 'theme' ? 'Haunted Theme activated! Look at your new purple night world.' : `${rewardNames[selectedReward]} claimed!`);
  sound();
});
$('close-modal').addEventListener('click', () => $('reward-modal').classList.remove('show'));
$('reward-modal').addEventListener('click', event => {
  if (event.target.id === 'reward-modal') $('reward-modal').classList.remove('show');
});

const buddyLines = [
  'Keep moving, survivor. Those tasks will not finish themselves!',
  'Brains are cool, but completed missions are cooler.',
  'One mission at a time. You have got this!',
  'Stay focused. The graveyard can wait.'
];
let buddyIndex = 0;

document.getElementById('buddy-button').addEventListener('click', () => {
    buddyIndex = (buddyIndex + 1) % buddyLines.length;
    document.getElementById('buddy-message').textContent = buddyLines[buddyIndex];
});
$('notification-toggle').addEventListener('click', async () => {
  if (!('Notification' in window)) { toast('Notifications are not supported by this browser.'); return; }
  try {
    const permission = await Notification.requestPermission();
    $('notification-toggle').textContent = permission === 'granted' ? 'Enabled' : 'Enable';
    toast(permission === 'granted' ? 'Browser alerts enabled!' : 'Notification permission was not granted.');
  } catch { toast('Could not enable notifications in this browser.'); }
});

// Check once per second and whenever the browser tab becomes active again.
function refreshDeadlines() { checkDeadlines(); render(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDeadlines(); });
window.addEventListener('focus', refreshDeadlines);
setInterval(checkDeadlines, 1000);

update(); render(); checkDeadlines();
save();