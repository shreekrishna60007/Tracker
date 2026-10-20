
/* =========================================================
   TRACKER - EXPENSE & BUDGETS
   Storage: Database
   Files required: index.html, style.css, script.js
========================================================= */

"use strict";

/* ---------- 1. CONFIGURATION & STORAGE ---------- */

const STORAGE_KEY = "trackerExpenseBudgets_v1";

const defaultData = {
  transactions: [],
  goals: [],
  debts: [],
  settings: {
    name: "Student",
    currency: "INR",
    budget: 5000,
    dark: false
  }
};

let data = loadData();
let currentPage = "home";
let activeChartPeriod = "month";
let charts = {};
let toastTimer;

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultData);

    const parsed = JSON.parse(saved);

    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      settings: { ...defaultData.settings, ...(parsed.settings || {}) }
    };
  } catch (error) {
    console.error("Could not load saved data:", error);
    return structuredClone(defaultData);
  }
}


function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Could not save Tracker data:", error);
    showToast("Could not save data. Browser storage may be full.");
    return false;
  }
}


function uid() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
  return todayISO().slice(0, 7);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function money(value) {
  const currency = data.settings.currency || "INR";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  } catch {
    return "₹" + (Number(value) || 0).toFixed(2);
  }
}

function formatDate(date) {
  if (!date) return "No date";
  const d = new Date(date + "T00:00:00");

  if (Number.isNaN(d.getTime())) return date;

  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function monthName(month) {
  const d = new Date(month + "-01T00:00:00");
  return d.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric"
  });
}

function sum(items, predicate = () => true) {
  return items.reduce((total, item) => {
    return total + (predicate(item) ? Number(item.amount || 0) : 0);
  }, 0);
}

function transactionsForMonth(month = currentMonth()) {
  return data.transactions.filter(t => t.date?.startsWith(month));
}

function getIncome(items) {
  return sum(items, t => t.type === "income");
}

function getExpenses(items) {
  return sum(items, t => t.type === "expense");
}

function getBalance(items = data.transactions) {
  return getIncome(items) - getExpenses(items);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

/* ---------- 2. NAVIGATION ---------- */

const pageTitles = {
  home: "Good day! 👋",
  charts: "Your money, visualized 📊",
  add: "Add a transaction ✨",
  reports: "Reports & transactions",
  settings: "Settings ⚙",
  goals: "Savings goals ✨",
  borrow: "Borrow & lend ↔"
};

function navigate(page) {
  const target = document.getElementById("page-" + page);
  if (!target) return;

  currentPage = page;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle("active", section.id === "page-" + page);
  });

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  document.getElementById("pageTitle").textContent =
    pageTitles[page] || "Tracker";

  if (page === "charts") renderCharts();
  if (page === "reports") renderReports();
  if (page === "goals") renderGoals();
  if (page === "borrow") renderDebts();
  if (page === "settings") populateSettings();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-page]");
  if (button) {
    event.preventDefault();
    navigate(button.dataset.page);
  }
});

/* ---------- 3. CATEGORY OPTIONS ---------- */

const categories = {
  expense: [
    ["food", "🍔 Food & drinks"],
    ["travel", "🚌 Transport"],
    ["education", "📚 Education"],
    ["shopping", "🛍️ Shopping"],
    ["entertainment", "🎮 Entertainment"],
    ["bills", "📱 Bills & recharge"],
    ["health", "💊 Health"],
    ["personal", "✨ Personal care"],
    ["rent", "🏠 Rent & housing"],
    ["other", "📦 Other"]
  ],
  income: [
    ["pocket-money", "💸 Pocket money"],
    ["salary", "💼 Salary / internship"],
    ["freelance", "💻 Freelancing"],
    ["scholarship", "🎓 Scholarship"],
    ["gift", "🎁 Gift"],
    ["refund", "↩️ Refund"],
    ["other", "📦 Other"]
  ]
};

function populateCategories(type, selected = "") {
  const select = document.getElementById("category");
  select.innerHTML = categories[type].map(([value, label]) =>
    `<option value="${value}">${label}</option>`
  ).join("");

  if (selected && categories[type].some(c => c[0] === selected)) {
    select.value = selected;
  }
}

let transactionType = "expense";

document.querySelectorAll(".type-btn").forEach(button => {
  button.addEventListener("click", () => {
    transactionType = button.dataset.type;

    document.getElementById("transactionType").value = transactionType;

    document.querySelectorAll(".type-btn").forEach(btn => {
      btn.classList.toggle("selected", btn === button);
      btn.classList.toggle(
        "income-type",
        btn === button && transactionType === "income"
      );
    });

    populateCategories(transactionType);
  });
});

populateCategories("expense");

/* ---------- 4. ADD TRANSACTIONS ---------- */

document.getElementById("date").value = todayISO();
document.getElementById("debtDate").value = todayISO();

document.getElementById("transactionForm").addEventListener("submit", async event =>  {
  event.preventDefault();

  const amount = Number(document.getElementById("amount").value);
  const description = document.getElementById("description").value.trim();
  const category = document.getElementById("category").value;
  const date = document.getElementById("date").value;
  const payment = document.getElementById("paymentMethod").value;
  const notes = document.getElementById("notes").value.trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Please enter an amount greater than zero.");
    return;
  }

  if (!description || !date) {
    showToast("Please fill in the required fields.");
    return;
  }

  
  const transaction = {
    id: uid(),
    type: transactionType,
    amount: Math.round(amount * 100) / 100,
    description,
    category,
    date,
    payment,
    notes,
    createdAt: new Date().toISOString()
  };

  try {
    await cloudInsert("tracker_transactions", {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      category: transaction.category,
      date: transaction.date,
      payment: transaction.payment,
      notes: transaction.notes,
      created_at: transaction.createdAt
    });

    data.transactions.push(transaction);
    saveData();
  } catch (error) {
    console.error("Could not save transaction to Supabase:", error);
    showToast("Transaction was not saved: " + error.message);
    return;
  }


  event.target.reset();

  document.getElementById("date").value = todayISO();
  document.getElementById("paymentMethod").value = "UPI";
  transactionType = "expense";
  document.getElementById("transactionType").value = "expense";

  document.querySelectorAll(".type-btn").forEach(button => {
    const selected = button.dataset.type === "expense";
    button.classList.toggle("selected", selected);
    button.classList.remove("income-type");
  });

  populateCategories("expense");
  document.getElementById("transactionMessage").textContent =
    "✓ Transaction saved successfully!";

  renderAll();
  showToast("Transaction added successfully!");
  navigate("home");
});

/* ---------- 5. TRANSACTION DISPLAY ---------- */

const categoryIcons = {
  food: "🍔",
  travel: "🚌",
  education: "📚",
  shopping: "🛍️",
  entertainment: "🎮",
  bills: "📱",
  health: "💊",
  personal: "✨",
  rent: "🏠",
  "pocket-money": "💸",
  salary: "💼",
  freelance: "💻",
  scholarship: "🎓",
  gift: "🎁",
  refund: "↩️",
  other: "📦"
};

function transactionRow(t, showActions = false) {
  const income = t.type === "income";
  const icon = categoryIcons[t.category] || "💰";

  return `
    <div class="transaction-row">
      <div class="transaction-icon ${income ? "income" : ""}">${icon}</div>
      <div class="transaction-info">
        <strong>${escapeHTML(t.description)}</strong>
        <small>${escapeHTML(t.category || "other")} · ${formatDate(t.date)} · ${escapeHTML(t.payment || "Other")}</small>
      </div>
      <div class="transaction-amount ${income ? "income" : "expense"}">
        ${income ? "+" : "−"}${money(t.amount)}
      </div>
      ${showActions ? `
        <div class="row-actions">
          <button class="icon-btn" data-delete-transaction="${escapeHTML(t.id)}" aria-label="Delete transaction">✕</button>
        </div>
      ` : ""}
    </div>`;
}

function emptyState(message) {
  return `<div class="empty-state"><span>🌱</span>${escapeHTML(message)}</div>`;
}

function renderRecent() {
  const recent = [...data.transactions]
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") ||
      (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);

  document.getElementById("recentTransactions").innerHTML =
    recent.length
      ? recent.map(t => transactionRow(t)).join("")
      : emptyState("No transactions yet. Add your first one to get started!");
}

document.addEventListener("click", async event => {
  const deleteButton = event.target.closest("[data-delete-transaction]");
  if (!deleteButton) return;

  const id = deleteButton.dataset.deleteTransaction;
  const transaction = data.transactions.find(t => t.id === id);

  if (!transaction) return;

  if (!confirm(`Delete "${transaction.description}"? This cannot be undone.`)) {
    return;
  }

  try {
    await cloudDelete("tracker_transactions", id);

    data.transactions = data.transactions.filter(t => t.id !== id);
    saveData();
    renderAll();
    showToast("Transaction deleted.");
  } catch (error) {
    console.error("Could not delete transaction:", error);
    showToast("Delete failed: " + error.message);
  }

});

/* ---------- 6. DASHBOARD & BUDGET ---------- */

function renderDashboard() {
  const all = data.transactions;
  const monthly = transactionsForMonth();

  const income = getIncome(all);
  const expenses = getExpenses(all);
  const saved = getBalance(monthly);
  const spent = getExpenses(monthly);
  const budget = Math.max(0, Number(data.settings.budget) || 0);
  const percent = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 100 : 0;
  const remaining = budget - spent;

  document.getElementById("totalBalance").textContent = money(income - expenses);
  document.getElementById("totalIncome").textContent = money(income);
  document.getElementById("totalExpense").textContent = money(expenses);
  document.getElementById("monthlySaved").textContent = money(saved);

  document.getElementById("budgetSpent").textContent = money(spent);
  document.getElementById("budgetLimit").textContent = money(budget);
  document.getElementById("budgetPercent").textContent =
    budget === 0 ? "No budget set" : `${Math.round(percent)}% used`;
  document.getElementById("budgetRemaining").textContent =
    remaining >= 0
      ? `${money(remaining)} left`
      : `${money(Math.abs(remaining))} over budget`;

  const progress = document.getElementById("budgetProgress");
  progress.style.width = Math.min(percent, 100) + "%";
  progress.classList.toggle("over", percent > 100);

  let note = "✦ You're all set. Spend mindfully!";
  if (budget === 0) {
    note = "✦ Set a monthly budget in Settings to get started.";
  } else if (percent >= 100) {
    note = "⚠ You've reached or exceeded your monthly budget.";
  } else if (percent >= 80) {
    note = "⚠ You're getting close to your monthly limit.";
  }

  document.getElementById("budgetNote").textContent = note;
}

function renderAll() {
  applySettings();
  renderDashboard();
  renderRecent();
  renderHomeGoals();

  if (currentPage === "charts") renderCharts();
  if (currentPage === "reports") renderReports();
  if (currentPage === "goals") renderGoals();
  if (currentPage === "borrow") renderDebts();
}

/* ---------- 7. SAVINGS GOALS ---------- */

document.getElementById("goalForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = document.getElementById("goalName").value.trim();
  const target = Number(document.getElementById("goalTarget").value);
  const saved = Number(document.getElementById("goalSaved").value);
  const date = document.getElementById("goalDate").value;

  if (!name || !Number.isFinite(target) || target <= 0 ||
      !Number.isFinite(saved) || saved < 0) {
    showToast("Enter a valid goal and amounts.");
    return;
  }

  if (saved > target) {
    showToast("Already saved cannot exceed the target amount.");
    return;
  }

  
  const goal = {
    id: uid(),
    name,
    target: Math.round(target * 100) / 100,
    saved: Math.round(saved * 100) / 100,
    date
  };

  try {
    await cloudInsert("tracker_goals", goal);
    data.goals.push(goal);
    saveData();
  } catch (error) {
    console.error("Could not save goal:", error);
    showToast("Goal was not saved: " + error.message);
    return;
  }

  event.target.reset();
  document.getElementById("goalSaved").value = "0";

  renderAll();
  showToast("Savings goal created!");
});

function goalMarkup(goal) {
  const target = Number(goal.target) || 0;
  const saved = Number(goal.saved) || 0;
  const percent = target > 0 ? Math.min(saved / target * 100, 100) : 0;
  const completed = target > 0 && saved >= target;

  return `
    <div class="goal-item">
      <div class="goal-top">
        <div>
          <strong>${escapeHTML(goal.name)} ${completed ? "✓" : ""}</strong>
          <small>${goal.date ? "Target: " + formatDate(goal.date) : "Your next big thing"}</small>
        </div>
        <div class="goal-numbers">${money(saved)} / ${money(target)}</div>
      </div>
      <div class="goal-track"><span style="width:${percent}%"></span></div>
      <small>${Math.round(percent)}% completed</small>
      <div class="goal-controls">
        <input class="field" type="number" min="0.01" step="0.01" placeholder="Amount" id="contribute-${escapeHTML(goal.id)}" aria-label="Amount to add to ${escapeHTML(goal.name)}">
        <button class="btn outline-btn" data-contribute="${escapeHTML(goal.id)}">+ Save</button>
        <button class="icon-btn" data-delete-goal="${escapeHTML(goal.id)}" aria-label="Delete goal">✕</button>
      </div>
    </div>`;
}

function renderGoals() {
  const list = document.getElementById("goalList");

  list.innerHTML = data.goals.length
    ? data.goals.map(goalMarkup).join("")
    : emptyState("Your first savings goal is waiting. What are you saving for?");

  renderHomeGoals();
}

function renderHomeGoals() {
  const container = document.getElementById("homeGoals");
  if (!container) return;

  container.innerHTML = data.goals.length
    ? data.goals.slice(0, 3).map(goal => {
        const percent = goal.target > 0
          ? Math.min(goal.saved / goal.target * 100, 100)
          : 0;

        return `
          <div class="goal-item">
            <div class="goal-top">
              <div><strong>${escapeHTML(goal.name)}</strong><small>${Math.round(percent)}% of your goal</small></div>
              <div class="goal-numbers">${money(goal.saved)} / ${money(goal.target)}</div>
            </div>
            <div class="goal-track"><span style="width:${percent}%"></span></div>
          </div>`;
      }).join("")
    : emptyState("No goals yet. Start saving for something you love!");
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-contribute]");
  if (button) {
    const id = button.dataset.contribute;
    const goal = data.goals.find(g => g.id === id);
    const input = document.getElementById("contribute-" + id);
    const amount = Number(input?.value);

    if (!goal || !Number.isFinite(amount) || amount <= 0) {
      showToast("Enter an amount greater than zero.");
      return;
    }

    if (goal.saved + amount > goal.target) {
      showToast("That amount exceeds your remaining goal.");
      return;
    }

  
    const previousSaved = goal.saved;
    goal.saved = Math.round((goal.saved + amount) * 100) / 100;

    try {
      await cloudUpdate("tracker_goals", id, {
        saved: goal.saved
      });

      saveData();
      renderAll();
      showToast("Your savings goal was updated!");
    } catch (error) {
      goal.saved = previousSaved;
      console.error("Could not update goal:", error);
      showToast("Goal update failed: " + error.message);
    }

  }

  const deleteButton = event.target.closest("[data-delete-goal]");
  if (deleteButton) {
    const goal = data.goals.find(g => g.id === deleteButton.dataset.deleteGoal);
    if (!goal) return;

    if (!confirm(`Delete the goal "${goal.name}"?`)) return;
    
    try {
      await cloudDelete("tracker_goals", goal.id);

      data.goals = data.goals.filter(g => g.id !== goal.id);
      saveData();
      renderAll();
      showToast("Savings goal deleted.");
    } catch (error) {
      console.error("Could not delete goal:", error);
      showToast("Goal deletion failed: " + error.message);
    }

  }
});

/* ---------- 8. BORROW & LEND ---------- */

document.getElementById("borrowForm").addEventListener("submit", async event => {
  event.preventDefault();

  const type = document.getElementById("debtType").value;
  const person = document.getElementById("debtPerson").value.trim();
  const amount = Number(document.getElementById("debtAmount").value);
  const date = document.getElementById("debtDate").value;
  const note = document.getElementById("debtNote").value.trim();

  if (!person || !Number.isFinite(amount) || amount <= 0 || !date) {
    showToast("Please enter a name, valid amount, and date.");
    return;
  }

const debt = {
  id: uid(),
  type,
  person,
  amount: Math.round(amount * 100) / 100,
  paid: 0,
  date,
  note
};

try {
  await cloudInsert("tracker_debts", debt);

  data.debts.push(debt);
  saveData();
} catch (error) {
  console.error("Could not save debt:", error);
  showToast("Debt was not saved: " + error.message);
  return;
}
  event.target.reset();
  document.getElementById("debtDate").value = todayISO();

  renderAll();
  showToast("Borrow/lend record saved!");
});

function debtRemaining(debt) {
  return Math.max(0, Number(debt.amount) - Number(debt.paid || 0));
}

function renderDebts() {
  const activeDebts = data.debts.filter(d => debtRemaining(d) > 0);
  const borrowed = sum(activeDebts, d => d.type === "borrow");
  const lent = sum(activeDebts, d => d.type === "lend");

  document.getElementById("iOwe").textContent = money(borrowed);
  document.getElementById("owedToMe").textContent = money(lent);
  document.getElementById("outstanding").textContent = money(borrowed + lent);

  const list = document.getElementById("debtList");

  list.innerHTML = activeDebts.length
    ? activeDebts.map(d => `
      <div class="transaction-row">
        <div class="transaction-icon ${d.type === "lend" ? "income" : ""}">↔</div>
        <div class="transaction-info">
          <strong>${escapeHTML(d.person)}</strong>
          <small>${d.type === "borrow" ? "You owe" : "Owed to you"} · ${formatDate(d.date)}${d.note ? " · " + escapeHTML(d.note) : ""}</small>
          ${Number(d.paid || 0) > 0 ? `<small>Paid: ${money(d.paid)} of ${money(d.amount)}</small>` : ""}
        </div>
        <div class="transaction-amount ${d.type === "lend" ? "income" : "expense"}">${money(debtRemaining(d))}</div>
        <div class="row-actions">
          <button class="icon-btn" data-pay-debt="${escapeHTML(d.id)}">Settle</button>
          <button class="icon-btn" data-delete-debt="${escapeHTML(d.id)}" aria-label="Delete record">✕</button>
        </div>
      </div>`).join("")
    : emptyState("No outstanding debts. You're all caught up!");

  if (data.debts.some(d => debtRemaining(d) === 0)) {
    list.innerHTML += `
      <details style="margin-top:16px">
        <summary style="cursor:pointer;font-size:12px;color:var(--muted)">Show settled records</summary>
        ${data.debts.filter(d => debtRemaining(d) === 0).map(d => `
          <div class="transaction-row">
            <div class="transaction-info"><strong>${escapeHTML(d.person)}</strong><small>Settled · ${d.type === "borrow" ? "You borrowed" : "You lent"}</small></div>
            <div class="transaction-amount">${money(d.amount)}</div>
            <button class="icon-btn" data-delete-debt="${escapeHTML(d.id)}">✕</button>
          </div>`).join("")}
      </details>`;
  }
}

document.addEventListener("click", async event => {
  const settleButton = event.target.closest("[data-pay-debt]");
  if (settleButton) {
    const debt = data.debts.find(d => d.id === settleButton.dataset.payDebt);
    if (!debt) return;

    const remaining = debtRemaining(debt);
    const answer = prompt(
      `Remaining amount: ${money(remaining)}\nEnter the amount settled:`,
      String(remaining)
    );

    if (answer === null) return;

    const amount = Number(answer);

    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      showToast("Enter a valid amount within the remaining balance.");
      return;
    }

  const previousPaid = Number(debt.paid || 0);
  debt.paid = Math.round((previousPaid + amount) * 100) / 100;

  try {
    await cloudUpdate("tracker_debts", debt.id, {
      paid: debt.paid
    });

    saveData();
    renderAll();
    showToast("Settlement recorded!");
  } catch (error) {
    debt.paid = previousPaid;
    console.error("Could not update debt settlement:", error);
    showToast("Settlement failed: " + error.message);
  }
  }

 const deleteButton = event.target.closest("[data-delete-debt]");

if (deleteButton) {
  const debt = data.debts.find(
    d => d.id === deleteButton.dataset.deleteDebt
  );

  if (!debt) return;

  if (!confirm(`Delete the record for ${debt.person}?`)) return;

  try {
    await cloudDelete("tracker_debts", debt.id);

    data.debts = data.debts.filter(d => d.id !== debt.id);
    saveData();
    renderAll();
    showToast("Record deleted.");
  } catch (error) {
    console.error("Could not delete debt:", error);
    showToast("Delete failed: " + error.message);
  }
}
});

/* ---------- 9. REPORTS & FILTERS ---------- */

function updateMonthFilter() {
  const select = document.getElementById("filterMonth");
  const previous = select.value;

  const months = [...new Set(
    data.transactions
      .map(t => (t.date || "").slice(0, 7))
      .filter(m => /^\d{4}-\d{2}$/.test(m))
  )].sort().reverse();

  select.innerHTML = `<option value="all">All months</option>` +
    months.map(m => `<option value="${m}">${monthName(m)}</option>`).join("");

  if (months.includes(previous)) select.value = previous;
}

function renderReports() {
  const all = data.transactions;

  document.getElementById("reportIncome").textContent = money(getIncome(all));
  document.getElementById("reportExpense").textContent = money(getExpenses(all));
  document.getElementById("reportCount").textContent = all.length;

  updateMonthFilter();

  const search = document.getElementById("searchTransactions").value
    .trim().toLowerCase();
  const type = document.getElementById("filterType").value;
  const month = document.getElementById("filterMonth").value;

  const filtered = [...all]
    .filter(t => {
      const matchesSearch =
        `${t.description} ${t.category} ${t.notes || ""} ${t.payment || ""}`
          .toLowerCase().includes(search);
      const matchesType = type === "all" || t.type === type;
      const matchesMonth = month === "all" || t.date?.startsWith(month);

      return matchesSearch && matchesType && matchesMonth;
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") ||
      (b.createdAt || "").localeCompare(a.createdAt || ""));

  document.getElementById("allTransactions").innerHTML = filtered.length
    ? filtered.map(t => transactionRow(t, true)).join("")
    : emptyState(all.length
      ? "No transactions match these filters."
      : "Your reports will appear here once you add transactions.");
}

["searchTransactions", "filterType", "filterMonth"].forEach(id => {
  document.getElementById(id).addEventListener(
    id === "searchTransactions" ? "input" : "change",
    renderReports
  );
});

/* ---------- 10. CSV EXPORT ---------- */

function csvCell(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function downloadFile(filename, content, type) {
  const blob = new Blob(["\uFEFF", content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportTransactionsCSV() {
  const headers = [
    "Date", "Type", "Description", "Category",
    "Amount", "Payment Method", "Notes"
  ];

  const rows = data.transactions.map(t => [
    t.date,
    t.type,
    t.description,
    t.category,
    t.amount,
    t.payment,
    t.notes
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\r\n");

  downloadFile(
    "tracker-transactions-" + todayISO() + ".csv",
    csv,
    "text/csv;charset=utf-8;"
  );

  showToast("CSV report downloaded!");
}

document.getElementById("exportCsv").addEventListener(
  "click",
  exportTransactionsCSV
);

/* ---------- 11. CHARTS ---------- */

function chartTransactions() {
  if (activeChartPeriod === "all") return data.transactions;
  return transactionsForMonth();
}

function destroyCharts() {
  Object.values(charts).forEach(chart => {
    if (chart && typeof chart.destroy === "function") chart.destroy();
  });
  charts = {};
}

function renderCharts() {
  const items = chartTransactions();

  const income = getIncome(items);
  const expenses = getExpenses(items);

  document.getElementById("chartIncome").textContent = money(income);
  document.getElementById("chartExpense").textContent = money(expenses);
  document.getElementById("chartSavings").textContent = money(income - expenses);

  destroyCharts();

  if (typeof Chart === "undefined") {
    document.querySelectorAll(".chart-box").forEach(box => {
      box.innerHTML = "<p class='empty-state'>Charts need an internet connection to load the Chart.js library.</p>";
    });
    return;
  }

  const textColor = getComputedStyle(document.body)
    .getPropertyValue("--muted").trim() || "#89869d";
  const gridColor = getComputedStyle(document.body)
    .getPropertyValue("--border").trim() || "#eeebf5";

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: textColor,
          usePointStyle: true,
          boxWidth: 8,
          font: { size: 11 }
        }
      }
    }
  };

  charts.incomeExpense = new Chart(
    document.getElementById("incomeExpenseChart"),
    {
      type: "bar",
      data: {
        labels: ["Income", "Expenses"],
        datasets: [{
          data: [income, expenses],
          backgroundColor: ["#9be9c4", "#a58aef"],
          borderRadius: 8,
          maxBarThickness: 65
        }]
      },
      options: {
        ...commonOptions,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    }
  );

  const categoryTotals = {};

  items.filter(t => t.type === "expense").forEach(t => {
    categoryTotals[t.category || "other"] =
      (categoryTotals[t.category || "other"] || 0) + Number(t.amount || 0);
  });

  const categoryEntries = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1]);

  charts.category = new Chart(
    document.getElementById("categoryChart"),
    {
      type: "doughnut",
      data: {
        labels: categoryEntries.map(([key]) => {
          const item = categories.expense.concat(categories.income)
            .find(c => c[0] === key);
          return item ? item[1] : key;
        }),
        datasets: [{
          data: categoryEntries.map(([, amount]) => amount),
          backgroundColor: [
            "#8d6bea", "#a3e8c6", "#ffb7ce", "#ffd98d",
            "#90b8f5", "#c7b4f5", "#f4a77b", "#9fdde3",
            "#c1df93", "#e6c0e7"
          ],
          borderWidth: 2,
          borderColor: getComputedStyle(document.body)
            .getPropertyValue("--surface").trim() || "#fff"
        }]
      },
      options: {
        ...commonOptions,
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textColor,
              usePointStyle: true,
              boxWidth: 8,
              padding: 13,
              font: { size: 10 }
            }
          }
        }
      }
    }
  );

  const monthKeys = [];

  if (activeChartPeriod === "month") {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }
  } else {
    const existingMonths = [...new Set(
      items.map(t => t.date?.slice(0, 7)).filter(Boolean)
    )].sort();

    monthKeys.push(...existingMonths.slice(-12));

    if (!monthKeys.length) monthKeys.push(currentMonth());
  }

  const incomeByMonth = monthKeys.map(month =>
    getIncome(items.filter(t => t.date?.startsWith(month)))
  );

  const expensesByMonth = monthKeys.map(month =>
    getExpenses(items.filter(t => t.date?.startsWith(month)))
  );

  charts.trend = new Chart(
    document.getElementById("trendChart"),
    {
      type: "line",
      data: {
        labels: monthKeys.map(monthName),
        datasets: [
          {
            label: "Income",
            data: incomeByMonth,
            borderColor: "#42b986",
            backgroundColor: "#42b98622",
            fill: true,
            tension: .35
          },
          {
            label: "Expenses",
            data: expensesByMonth,
            borderColor: "#9069e9",
            backgroundColor: "#9069e922",
            fill: true,
            tension: .35
          }
        ]
      },
      options: {
        ...commonOptions,
        interaction: { intersect: false, mode: "index" },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    }
  );
}

document.getElementById("chartPeriod").addEventListener("change", event => {
  activeChartPeriod = event.target.value;
  renderCharts();
});

/* ---------- 12. SETTINGS & DARK MODE ---------- */

function populateSettings() {
  document.getElementById("userName").value = data.settings.name || "";
  document.getElementById("currency").value = data.settings.currency || "INR";
  document.getElementById("monthlyBudgetInput").value =
    Number(data.settings.budget) || 0;
  document.getElementById("darkMode").checked = Boolean(data.settings.dark);
  updateProfilePhotoPreview();
}


function applySettings() {
  document.body.classList.toggle("dark", Boolean(data.settings.dark));

  const name = (data.settings.name || "Student").trim() || "Student";

  document.getElementById("headerName").textContent = name;

  const avatar = document.getElementById("avatar");
  const photo = data.settings.profilePhoto;

  if (photo) {
    avatar.replaceChildren();

    const img = document.createElement("img");
    img.src = photo;
    img.alt = name + "'s profile photo";

    avatar.appendChild(img);
    avatar.classList.add("has-photo");
  } else {
    avatar.classList.remove("has-photo");
    avatar.textContent = [...name][0]?.toUpperCase() || "S";
  }
}


/* ---------- PROFILE PHOTO UPLOAD: SUPABASE STORAGE ---------- */

const profilePhotoInput = document.getElementById("profilePhoto");
const profilePhotoPreview = document.getElementById("profilePhotoPreview");
const removeProfilePhotoButton = document.getElementById("removeProfilePhoto");

const PROFILE_BUCKET = "profile-photos";

async function showCloudProfilePhoto(path) {
  if (!path) {
    data.settings.profilePhoto = "";
    updateProfilePhotoPreview();
    applySettings();
    return;
  }

  const { data: signedData, error } = await trackerSupabase.storage
    .from(PROFILE_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) throw error;

  data.settings.profilePhoto = signedData.signedUrl;
  updateProfilePhotoPreview();
  applySettings();
}

function updateProfilePhotoPreview() {
  if (!profilePhotoPreview) return;

  const photo = data.settings.profilePhoto;

  if (photo) {
    profilePhotoPreview.src = photo;
    profilePhotoPreview.hidden = false;
  } else {
    profilePhotoPreview.removeAttribute("src");
    profilePhotoPreview.hidden = true;
  }
}

if (profilePhotoInput) {
  profilePhotoInput.addEventListener("change", async function () {
    const file = this.files[0];
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (!allowedTypes.includes(file.type)) {
      showToast("Please select a JPG, PNG, WebP, or GIF image.");
      this.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Please choose an image smaller than 5 MB.");
      this.value = "";
      return;
    }

    if (!trackerCloudReady || !trackerCurrentUserId) {
      showToast("Please sign in before uploading a profile photo.");
      this.value = "";
      return;
    }

    const previousPhoto = data.settings.profilePhoto;
    this.disabled = true;

    try {
      const imageData = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const image = new Image();

          image.onload = () => {
            const maxSize = 400;
            const scale = Math.min(
              1,
              maxSize / Math.max(image.width, image.height)
            );

            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));

            const context = canvas.getContext("2d");

            if (!context) {
              reject(new Error("Could not process this image."));
              return;
            }

            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
              blob => blob
                ? resolve(blob)
                : reject(new Error("Could not process this image.")),
              "image/jpeg",
              0.82
            );
          };

          image.onerror = () => reject(new Error("Could not open this image."));
          image.src = reader.result;
        };

        reader.onerror = () => reject(new Error("Could not read this photo."));
        reader.readAsDataURL(file);
      });

      const userId = trackerCurrentUserId;
      const photoPath = `${userId}/profile.jpg`;

      const { error: uploadError } = await trackerSupabase.storage
        .from(PROFILE_BUCKET)
        .upload(photoPath, imageData, {
          contentType: "image/jpeg",
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: settingsError } = await trackerSupabase
        .from("tracker_settings")
        .update({ profile_photo_url: photoPath })
        .eq("user_id", userId);

      if (settingsError) throw settingsError;

      await showCloudProfilePhoto(photoPath);
      saveData();

      showToast("Profile photo uploaded and saved!");
    } catch (error) {
      console.error("Profile photo upload failed:", error);
      data.settings.profilePhoto = previousPhoto;
      updateProfilePhotoPreview();
      applySettings();
      showToast("Photo upload failed: " + error.message);
    } finally {
      this.disabled = false;
    }
  });
}

if (removeProfilePhotoButton) {
  removeProfilePhotoButton.addEventListener("click", async function () {
    if (!trackerCloudReady || !trackerCurrentUserId) {
      showToast("Please sign in and try again.");
      return;
    }

    if (!data.settings.profilePhoto) {
      showToast("No profile photo to remove.");
      return;
    }

    this.disabled = true;

    try {
      const userId = trackerCurrentUserId;
      const photoPath = `${userId}/profile.jpg`;

      const { error: deleteError } = await trackerSupabase.storage
        .from(PROFILE_BUCKET)
        .remove([photoPath]);

      if (deleteError) throw deleteError;

      const { error: settingsError } = await trackerSupabase
        .from("tracker_settings")
        .update({ profile_photo_url: null })
        .eq("user_id", userId);

      if (settingsError) throw settingsError;

      data.settings.profilePhoto = "";

      if (profilePhotoInput) profilePhotoInput.value = "";

      saveData();
      updateProfilePhotoPreview();
      applySettings();

      showToast("Profile photo removed from Supabase.");
    } catch (error) {
      console.error("Could not remove profile photo:", error);
      showToast("Could not remove photo: " + error.message);
    } finally {
      this.disabled = false;
    }
  });
}


document.getElementById("darkMode").addEventListener("change", async event => {
  const previousDark = data.settings.dark;
  const newDark = event.target.checked;

  if (!trackerCloudReady || !trackerCurrentUserId) {
    event.target.checked = previousDark;
    showToast("Please sign in and try again.");
    return;
  }

  try {
    const { error } = await trackerSupabase
      .from("tracker_settings")
      .update({ dark: newDark })
      .eq("user_id", trackerCurrentUserId);

    if (error) throw error;

    data.settings.dark = newDark;
    applySettings();
    saveData();

    if (currentPage === "charts") renderCharts();
  } catch (error) {
    event.target.checked = previousDark;
    data.settings.dark = previousDark;
    applySettings();

    console.error("Could not save dark mode:", error);
    showToast("Dark mode was not saved: " + error.message);
  }
});

/* ---------- 13. BACKUP & RESTORE ---------- */

document.getElementById("backupJson").addEventListener("click", () => {
  downloadFile(
    "tracker-backup-" + todayISO() + ".json",
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8;"
  );

  showToast("Full backup downloaded!");
});

document.getElementById("importJson").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    const valid =
      imported &&
      Array.isArray(imported.transactions) &&
      Array.isArray(imported.goals) &&
      Array.isArray(imported.debts) &&
      imported.settings &&
      typeof imported.settings === "object";

    if (!valid) {
      throw new Error("Invalid Tracker backup structure.");
    }

    if (!confirm("Import this backup and replace your current Tracker data? Download a backup of your current data first if you need it.")) {
      event.target.value = "";
      return;
    }

    const previousData = data;

    data = {
      transactions: imported.transactions,
      goals: imported.goals,
      debts: imported.debts,
      settings: { ...defaultData.settings, ...imported.settings }
    };

    if (!saveData()) {
      data = previousData;
      throw new Error("The backup could not be saved.");
    }

    applySettings();
    renderAll();
    populateSettings();
    
    showToast("Backup imported successfully!");
  } catch (error) {
    console.error(error);
    showToast("Import failed. Choose a valid Tracker backup.");
  }

  event.target.value = "";
});


/* ---------- 14. CLEAR DATA ---------- */

document.getElementById("clearData").addEventListener("click", async () => {
  const confirmed = confirm(
    "Permanently delete all your transactions, savings goals, and debts from your account? Your settings will reset to defaults. This cannot be undone. Export a backup first if needed."
  );

  if (!confirmed) return;

  if (!trackerCloudReady || !trackerCurrentUserId) {
    showToast("Please sign in and try again.");
    return;
  }

  const clearButton = document.getElementById("clearData");
  clearButton.disabled = true;

  try {
    const userId = trackerCurrentUserId;

    // Delete only this user's transactions.
    const { error: transactionsError } = await trackerSupabase
      .from("tracker_transactions")
      .delete()
      .eq("user_id", userId);

    if (transactionsError) throw transactionsError;

    // Delete only this user's savings goals.
    const { error: goalsError } = await trackerSupabase
      .from("tracker_goals")
      .delete()
      .eq("user_id", userId);

    if (goalsError) throw goalsError;

    // Delete only this user's borrow/lend records.
    const { error: debtsError } = await trackerSupabase
      .from("tracker_debts")
      .delete()
      .eq("user_id", userId);

    if (debtsError) throw debtsError;

    // Reset this user's cloud settings.
    const { error: settingsError } = await trackerSupabase
      .from("tracker_settings")
      .upsert({
        user_id: userId,
        name: "Student",
        currency: "INR",
        budget: 5000,
        dark: false,
        profile_photo_url: null
      }, { onConflict: "user_id" });

    if (settingsError) throw settingsError;

    // Reset the browser's in-memory data only after cloud operations succeed.
    data = structuredClone(defaultData);

    if (!saveData()) {
      showToast("Cloud data was cleared, but local storage could not be reset. Please reload the page.");
      return;
    }

    applySettings();
    populateSettings();
    renderAll();
    navigate("home");

    showToast("Your Tracker data has been cleared from the database.");
  } catch (error) {
    console.error("Could not clear all Tracker data:", error);
    showToast("Could not finish clearing data: " + error.message);
  } finally {
    clearButton.disabled = false;
  }
});


/* ---------- 15. INITIALIZATION ---------- */

function initializeApp() {
  document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).toUpperCase();

  document.getElementById("date").value = todayISO();
  document.getElementById("debtDate").value = todayISO();

  populateSettings();
  applySettings();
  renderAll();
  navigate("home");
}

initializeApp();

/* ---------- 16. SUPABASE AUTHENTICATION ---------- */

// Replace these two values with your own Supabase credentials.
const TRACKER_SUPABASE_URL = "https://gvrkiuvzabogiulkwndn.supabase.co";
const TRACKER_SUPABASE_KEY = "sb_publishable_IhmLqnFhDan6jerkQlu9sg_WtNCP_jv";

const trackerSupabase = window.supabase.createClient(
  TRACKER_SUPABASE_URL,
  TRACKER_SUPABASE_KEY
);

let trackerAuthMode = "signin";

const authForm = document.getElementById("authForm");

/* ---------- FORGOT PASSWORD ---------- */

const forgotPasswordLink = document.getElementById("forgotPasswordLink");

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById("authEmail");
    const authMessage = document.getElementById("authMessage");
    const email = emailInput.value.trim();

    if (!email) {
      authMessage.textContent =
        "Please enter your registered email address first.";
      emailInput.focus();
      return;
    }

    forgotPasswordLink.style.pointerEvents = "none";
    authMessage.textContent = "Sending password reset email...";

    try {
      const { error } =
        await trackerSupabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}?resetPassword=true`
        });

      if (error) throw error;

      authMessage.textContent =
        "If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.";
    } catch (error) {
      console.error("Password reset request failed:", error);
      authMessage.textContent =
        error.message || "Could not send the reset email. Please try again later.";
    } finally {
      forgotPasswordLink.style.pointerEvents = "";
    }
  });
}

const authToggle = document.getElementById("authToggle");
const authMessage = document.getElementById("authMessage");

function setTrackerAuthMode(mode) {
  trackerAuthMode = mode;

  const signingUp = mode === "signup";

  document.getElementById("authHeading").textContent =
    signingUp ? "Create your account" : "Welcome back!";

  document.getElementById("authDescription").textContent =
    signingUp
      ? "Create an account for your personal money tracker."
      : "Sign in to access your personal money tracker.";

  document.getElementById("authSubmit").textContent =
    signingUp ? "Create account" : "Sign in";

  document.getElementById("authSwitchText").textContent =
    signingUp ? "Already have an account?" : "Don't have an account?";

  authToggle.textContent =
    signingUp ? "Sign in" : "Create account";

  document.getElementById("authPassword").autocomplete =
    signingUp ? "new-password" : "current-password";

  authMessage.textContent = "";
}

authToggle.addEventListener("click", () => {
  setTrackerAuthMode(
    trackerAuthMode === "signin" ? "signup" : "signin"
  );
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const button = document.getElementById("authSubmit");
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  button.disabled = true;
  authMessage.textContent = "Please wait...";

  try {
    let result;

    if (trackerAuthMode === "signup") {
      result = await trackerSupabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            window.location.origin + window.location.pathname
        }
      });
    } else {
      result = await trackerSupabase.auth.signInWithPassword({
        email,
        password
      });
    }

    if (result.error) {
      throw result.error;
    }

    if (trackerAuthMode === "signup" && !result.data.session) {
      authMessage.textContent =
        "Account created. Check your email to confirm your address, then sign in.";
    } else {
     await connectTrackerCloud();
    }
  } catch (error) {
    console.error("Tracker authentication error:", error);
    authMessage.textContent =
      error.message || "Authentication failed. Please try again.";
  } finally {
    button.disabled = false;
  }
});


/* ---------- SET NEW PASSWORD ---------- */


const urlParams = new URLSearchParams(window.location.search);
const isPasswordReset = urlParams.get("resetPassword") === "true";

if (isPasswordReset) {
  showResetPasswordForm();

  if (authMessage) {
    authMessage.textContent = "Enter your new password below.";
  }
}

function showResetPasswordForm() {
  if (!resetPasswordForm || !authForm) return;

  authForm.hidden = true;
  resetPasswordForm.hidden = false;

  const forgotLink = document.getElementById("forgotPasswordLink");
  if (forgotLink) forgotLink.hidden = true;
}

if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = document.getElementById("newPassword").value;
    const confirmPassword =
      document.getElementById("confirmNewPassword").value;
    const message = document.getElementById("resetPasswordMessage");
    const button = document.getElementById("resetPasswordSubmit");

    if (password.length < 6) {
      message.textContent = "Your password must contain at least 6 characters.";
      return;
    }

    if (password !== confirmPassword) {
      message.textContent = "The passwords do not match.";
      return;
    }

    button.disabled = true;
    message.textContent = "Updating your password...";

    try {
      const { error } = await trackerSupabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      message.textContent =
        "Password updated successfully! You can now sign in with your new password.";

      resetPasswordForm.reset();

      await trackerSupabase.auth.signOut();

      resetPasswordForm.hidden = true;
      authForm.hidden = false;

      const forgotLink = document.getElementById("forgotPasswordLink");
      if (forgotLink) forgotLink.hidden = false;

      document.getElementById("authMessage").textContent =
        "Your password was changed. Please sign in again.";
    } catch (error) {
      console.error("Password update failed:", error);
      message.textContent =
        error.message || "Could not update your password. Request a new reset link.";
    } finally {
      button.disabled = false;
    }
  });
}



/* ---------- RESTORE EXISTING SESSION ---------- */
let trackerCloudReady = false;
let trackerCurrentUserId = null;

(async function checkTrackerSession() {
  try {
    const { data: sessionData, error } =
      await trackerSupabase.auth.getSession();

    if (error) throw error;

    const urlParams = new URLSearchParams(window.location.search);
    const isPasswordReset =
      urlParams.get("resetPassword") === "true";

    // Keep the password-reset screen separate from the dashboard.
    if (isPasswordReset) {
      showResetPasswordForm();
      return;
    }

    // Automatically reopen Tracker when a valid session exists.
    if (sessionData.session) {
      await connectTrackerCloud();
    }
  } catch (error) {
    console.error("Could not restore Tracker session:", error);
  }
})();




/* ---------- 17. TRACKER CLOUD INITIALIZATION ---------- */




async function connectTrackerCloud() {
  try {
    const { data: sessionResult, error: sessionError } =
      await trackerSupabase.auth.getSession();

    if (sessionError) throw sessionError;

    const userId = sessionResult.session?.user?.id;

    if (!userId) {
      throw new Error("Please sign in again.");
    }

    trackerCurrentUserId = userId;

    // Load this user's settings.
    const { data: cloudSettings, error: settingsError } =
      await trackerSupabase
        .from("tracker_settings")
        .select("name, currency, budget, dark, profile_photo_url")
        .eq("user_id", userId)
        .maybeSingle();

    if (settingsError) throw settingsError;

    
if (cloudSettings) {
  data.settings = {
    ...data.settings,
    name: cloudSettings.name || "Student",
    currency: cloudSettings.currency || "INR",
    budget: Number(cloudSettings.budget ?? 5000),
    dark: Boolean(cloudSettings.dark),
    profilePhoto: ""
  };

  // Load the saved photo from private Supabase Storage.
  if (cloudSettings.profile_photo_url) {
    try {
      await showCloudProfilePhoto(cloudSettings.profile_photo_url);
    } catch (photoError) {
      console.error("Could not load profile photo:", photoError);
      data.settings.profilePhoto = "";
    }
  }
}
 else {
      const { error } = await trackerSupabase
        .from("tracker_settings")
        .insert({
          user_id: userId,
          name: data.settings.name || "Student",
          currency: data.settings.currency || "INR",
          budget: Number(data.settings.budget ?? 5000),
          dark: Boolean(data.settings.dark),
          profile_photo_url: null
        });

      if (error) throw error;
    }

    // Load this user's transactions.
    const { data: transactions, error: transactionsError } =
      await trackerSupabase
        .from("tracker_transactions")
        .select("*")
        .eq("user_id", userId);

    if (transactionsError) throw transactionsError;

    // Load this user's savings goals.
    const { data: goals, error: goalsError } =
      await trackerSupabase
        .from("tracker_goals")
        .select("*")
        .eq("user_id", userId);

    if (goalsError) throw goalsError;

    // Load this user's borrow/lend records.
    const { data: debts, error: debtsError } =
      await trackerSupabase
        .from("tracker_debts")
        .select("*")
        .eq("user_id", userId);

    if (debtsError) throw debtsError;

    // Convert database field names to the app's existing field names.
    data.transactions = (transactions || []).map(t => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      category: t.category,
      date: t.date,
      payment: t.payment,
      notes: t.notes || "",
      createdAt: t.created_at
    }));

    data.goals = (goals || []).map(g => ({
      id: g.id,
      name: g.name,
      target: Number(g.target),
      saved: Number(g.saved),
      date: g.date
    }));

    data.debts = (debts || []).map(d => ({
      id: d.id,
      type: d.type,
      person: d.person,
      amount: Number(d.amount),
      paid: Number(d.paid),
      date: d.date,
      note: d.note || ""
    }));

    saveData();
    applySettings();
    populateSettings();
    renderAll();

    document.getElementById("authScreen").hidden = true;
    document.getElementById("trackerApp").hidden = false;

    trackerCloudReady = true;
    showToast("Tracker connected to Supabase!");
  } catch (error) {
    console.error("Tracker cloud connection failed:", error);

    trackerCloudReady = false;
    document.getElementById("authScreen").hidden = false;
    document.getElementById("trackerApp").hidden = true;

    authMessage.textContent =
      "Cloud connection failed: " + error.message;
  }
}


/* ---------- CLOUD DATABASE HELPERS ---------- */

async function cloudInsert(table, record) {
  if (!trackerCloudReady || !trackerCurrentUserId) {
    throw new Error("Cloud is not ready. Please sign in again.");
  }

  const { error } = await trackerSupabase
    .from(table)
    .insert({
      ...record,
      user_id: trackerCurrentUserId
    });

  if (error) throw error;
}

async function cloudUpdate(table, id, changes) {
  if (!trackerCloudReady || !trackerCurrentUserId) {
    throw new Error("Cloud is not ready. Please sign in again.");
  }

  const { error } = await trackerSupabase
    .from(table)
    .update(changes)
    .eq("id", id)
    .eq("user_id", trackerCurrentUserId);

  if (error) throw error;
}

async function cloudDelete(table, id) {
  if (!trackerCloudReady || !trackerCurrentUserId) {
    throw new Error("Cloud is not ready. Please sign in again.");
  }

  const { error } = await trackerSupabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("user_id", trackerCurrentUserId);

  if (error) throw error;
}


/* ---------- LOG OUT ---------- */

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (!window.confirm("Are you sure you want to log out?")) {
      return;
    }

    logoutBtn.disabled = true;

    try {
      const { error } = await trackerSupabase.auth.signOut();
      if (error) throw error;

      trackerCloudReady = false;
      trackerCurrentUserId = null;

      document.getElementById("trackerApp").hidden = true;
      document.getElementById("authScreen").hidden = false;

      document.getElementById("authForm").reset();
      document.getElementById("authMessage").textContent =
        "You have been logged out successfully.";

      const resetForm = document.getElementById("resetPasswordForm");
      if (resetForm) resetForm.hidden = true;

      const forgotLink = document.getElementById("forgotPasswordLink");
      if (forgotLink) forgotLink.hidden = false;

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    } catch (error) {
      console.error("Logout failed:", error);

      document.getElementById("logoutMessage").textContent =
        error.message || "Could not log out. Please try again.";
    } finally {
      logoutBtn.disabled = false;
    }
  });
}
