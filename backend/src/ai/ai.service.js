
const {
  analyzeSales,
} = require("./tools/sales.tools");

const {
  analyzeInventory,
} = require("./tools/inventory.tools");

const {
  analyzeExpenses,
  analyzeFinancialPerformance,
} = require("./tools/finance.tools");

const {
  analyzeBusinessOverview,
} = require("./tools/business.tools");

// Convert an amount into readable ETB.
function formatETB(amount) {
  return `${Number(amount || 0).toLocaleString("en-US")} ETB`;
}

// Check whether a message contains any keyword.
function containsAny(message, keywords) {
  return keywords.some((keyword) => message.includes(keyword));
}

/**
 * Identify what the business owner wants.
 */

/**
 * Detect what the user wants to know about their business.
 * This is rule-based intent detection, not an LLM.
 */
function detectIntent(message) {
  const text = message.toLowerCase().trim();

  // 1. Business overview
  const overviewPatterns = [
    /business overview/,
    /overall business/,
    /how is my business/,
    /how is my shop/,
    /how is the business doing/,
    /how are we doing/,
    /business performance/,
    /business summary/,
    /summarize my business/,
    /how is everything/,
  ];

  if (overviewPatterns.some((pattern) => pattern.test(text))) {
    return "business_overview";
  }

  // 2. Profit and loss
  const profitPatterns = [
    /profit/,
    /loss/,
    /making money/,
    /am i earning/,
    /how much did i earn/,
    /how much money did i make/,
    /net income/,
    /gross income/,
    /financial performance/,
    /business losing money/,
    /am i profitable/,
  ];

  if (profitPatterns.some((pattern) => pattern.test(text))) {
    return "profit";
  }

  // 3. Expenses
  const expensePatterns = [
    /expense/,
    /expenses/,
    /spending/,
    /spent/,
    /costs/,
    /where is my money going/,
    /how much did i spend/,
    /money spent/,
    /business expenditure/,
  ];

  if (expensePatterns.some((pattern) => pattern.test(text))) {
    return "expenses";
  }

  // 4. Inventory and stock
  const inventoryPatterns = [
    /inventory/,
    /stock/,
    /products/,
    /low stock/,
    /out of stock/,
    /running out/,
    /need restocking/,
    /restock/,
    /available items/,
    /how many items/,
  ];

  if (inventoryPatterns.some((pattern) => pattern.test(text))) {
    return "inventory";
  }

  // 5. Sales
  const salesPatterns = [
    /sales/,
    /sold/,
    /selling/,
    /revenue/,
    /turnover/,
    /how much did i sell/,
    /money from selling/,
    /daily sales/,
    /weekly sales/,
    /monthly sales/,
  ];

  if (salesPatterns.some((pattern) => pattern.test(text))) {
    return "sales";
  }

  // No recognized business intent
  return "unknown";
}



/**
 * Handle simple conversations that do not require business reports.
 */
function handleConversation(message) {
  const text = message.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!. ]*$/i.test(text)) {
    return "Hello! 👋 Welcome to EthioBiz AI.\n\nHow can I help you manage your business today?";
  }

  // Appreciation
  if (/^(thanks|thank you|thank you so much)[!. ]*$/i.test(text)) {
    return "You're welcome! 😊 I'm happy to help you understand your business.";
  }

  // Farewell
  if (/^(bye|goodbye|see you|see you later)[!. ]*$/i.test(text)) {
    return "Goodbye! 👋 Keep growing your business. I'll be here whenever you need help.";
  }

  // Assistant identity
  if (
    /^(who are you|what are you|what is your name)[?!. ]*$/i.test(text)
  ) {
    return "I'm EthioBiz AI, your business assistant. I help you understand your business performance using your recorded data.";
  }

  // Capabilities
  if (
    /^(what can you do|how can you help me|what do you do)[?!. ]*$/i.test(text)
  ) {
    return "I can help you with:\n\n📊 Sales reports\n💰 Profit and loss analysis\n🧾 Expense reports\n📦 Inventory and stock analysis\n📈 Overall business performance\n\nAsk me a question about any of these areas!";
  }

  // Help
  if (/^(help|help me|commands|what can i ask)[?!. ]*$/i.test(text)) {
    return "Here are some questions you can ask:\n\n• Show me my sales report\n• How much profit did I make?\n• Show me my expenses\n• How is my inventory?\n• Give me my business overview\n\nYou can also say Hello or ask what I can do.";
  }

  return null;
}


/**
 * Main EthioBiz AI agent function.
 *
 * The tenantId must come from authenticated backend
 * middleware, never from the user's message.
 */
async function handleUserMessage(message, tenantId) {
  if (!message || typeof message !== "string" || !message.trim()) {
    throw new Error("Please enter a valid question.");
  }

    // First, handle greetings and simple conversations.
  const conversationAnswer = handleConversation(message);

  if (conversationAnswer) {
    return {
      success: true,
      intent: "conversation",
      answer: conversationAnswer,
      data: null,
    };
  }

  // If it is not a conversation, detect the business intent.
  const intent = detectIntent(message);

  let data;
  let answer;

  switch (intent) {
    case "business_overview": {
      data = await analyzeBusinessOverview(tenantId);

      answer =
        `Here is your business overview:\n\n` +
        `Total sales: ${formatETB(data.sales.totalSalesETB)}\n` +
        `Gross profit: ${formatETB(data.sales.grossProfitETB)}\n` +
        `Total expenses: ${formatETB(data.finance.totalExpensesETB)}\n` +
        `Net profit/loss: ${formatETB(data.finance.netProfitETB)}\n` +
        `Total products: ${data.inventory.totalProducts}\n` +
        `Low-stock products: ${data.inventory.lowStockProducts}\n` +
        `Inventory value: ${formatETB(data.inventory.inventoryValueETB)}\n` +
        `Outstanding credit: ${formatETB(data.customerCredit.outstandingCreditETB)}`;

      break;
    }

    case "inventory": {
      data = await analyzeInventory(tenantId);

      answer =
        `Your inventory report:\n\n` +
        `Total products: ${data.totalProducts}\n` +
        `Low-stock products: ${data.lowStockProducts}\n` +
        `Inventory value: ${formatETB(data.inventoryValueETB)}`;

      break;
    }

    case "expenses": {
      data = await analyzeExpenses(tenantId);

      const categories = data.expensesByCategory
        .map(
          (item) =>
            `${item.category}: ${formatETB(item.amountETB)}`
        )
        .join("\n");

      answer =
        `Your expense report:\n\n` +
        `Total expenses: ${formatETB(data.totalExpensesETB)}\n` +
        `Number of expenses: ${data.expenseCount}\n\n` +
        `Expenses by category:\n${categories || "No expenses recorded."}`;

      break;
    }

    case "profit": {
      data = await analyzeFinancialPerformance(tenantId);

      answer =
        `Your financial performance:\n\n` +
        `Total sales: ${formatETB(data.totalSalesETB)}\n` +
        `Gross profit: ${formatETB(data.grossProfitETB)}\n` +
        `Total expenses: ${formatETB(data.totalExpensesETB)}\n` +
        `Net profit/loss: ${formatETB(data.netProfitETB)}`;

      break;
    }

    case "sales": {
      data = await analyzeSales(tenantId);

      answer =
        `Your sales report:\n\n` +
        `Total sales: ${formatETB(data.totalSalesETB)}\n` +
        `Number of sales: ${data.salesCount}\n` +
        `Gross profit: ${formatETB(data.grossProfitETB)}\n` +
        `Outstanding credit: ${formatETB(data.outstandingCreditETB)}`;

      break;
    }

    default:
      return {
        success: false,
        intent: "unknown",
        answer:
          "I could not identify your question. You can ask about sales, profit, expenses, inventory, or your overall business performance.",
      };
  }

  return {
    success: true,
    intent,
    answer,
    data,
  };
}

module.exports = {
  handleUserMessage,
  detectIntent,
};
