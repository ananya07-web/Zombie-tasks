const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const dueInput = document.getElementById("task-due");
const list = document.getElementById("task-list");
const emptyMsg = document.getElementById("empty");
const scoreEl = document.getElementById("score");

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let score = Number(localStorage.getItem("score")) || 0;

function save() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("score", score);
}

function isZombie(task) {
  return new Date(task.due) < new Date();
}

function render() {
  list.innerHTML = "";
  scoreEl.textContent = score;
  emptyMsg.style.display = tasks.length === 0 ? "block" : "none";

  tasks.forEach(function (task) {
    const zombie = isZombie(task);

    const li = document.createElement("li");
    li.className = zombie ? "task zombie" : "task";

    const icon = document.createElement("span");
    icon.className = "icon";
    icon.textContent = zombie ? "🧟" : "🕯️";

    const info = document.createElement("div");
    info.className = "info";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = task.text;

    const due = document.createElement("div");
    due.className = "due";
    const when = new Date(task.due).toLocaleString();
    due.textContent = zombie ? "Risen from the dead! Was due " + when : "Due " + when;

    info.appendChild(name);
    info.appendChild(due);

    const btn = document.createElement("button");
    btn.textContent = zombie ? "Kill" : "Done";
    btn.addEventListener("click", function () {
      finishTask(task.id);
    });

    li.appendChild(icon);
    li.appendChild(info);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

form.addEventListener("submit", function (event) {
  event.preventDefault();
  tasks.push({
    id: Date.now(),
    text: input.value.trim(),
    due: dueInput.value,
  });
  form.reset();
  save();
  render();
});

function finishTask(id) {
  const task = tasks.find(function (t) {
    return t.id === id;
  });
  score += isZombie(task) ? 10 : 5;
  tasks = tasks.filter(function (t) {
    return t.id !== id;
  });
  save();
  render();
}

render();
setInterval(render, 30000);