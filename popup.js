document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  const statusEl = document.getElementById("status");
  const titleEl = document.getElementById("recipeTitle");
  const ingredientsList = document.getElementById("ingredientsList");
  const instructionsList = document.getElementById("instructionsList");
  const imageEl = document.getElementById("recipeImage");
  const printButton = document.getElementById("printButton");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      statusEl.textContent = "No active tab found.";
      return;
    }

    // Run code in the page to grab the JSON-LD recipe
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractRecipeFromJsonLd,
    });

    const data = result?.result;

    if (!data) {
      statusEl.textContent = "No recipe JSON-LD found on this page.";
      return;
    }

    const { name, ingredients, instructions, imageUrl } = data;

    // Render title
    statusEl.textContent = "";
    if (name) {
      titleEl.textContent = name;
    }

    // Render image
    if (imageUrl) {
      imageEl.src = imageUrl;
      imageEl.style.display = "block";
    } else {
      imageEl.style.display = "none";
    }

    // Render ingredients
    ingredientsList.innerHTML = "";
    ingredients.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = roundDecimalsInText(item);
      ingredientsList.appendChild(li);
    });

    // Render instructions
    instructionsList.innerHTML = "";
    instructions.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      instructionsList.appendChild(li);
    });

    // Enable print button
    printButton.disabled = false;
    printButton.addEventListener("click", () => {
      openPrintWindow({ name, ingredients, instructions, imageUrl });
    });
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error reading recipe from this page.";
  }
}

/**
 * Rounds long decimals in text to the nearest hundredth (2 decimal places).
 * E.g., "1.333333 cups" becomes "1.33 cups"
 */
function roundDecimalsInText(text) {
  // Match decimal numbers with more than 2 decimal places
  return text.replace(/\b(\d+\.\d{3,})\b/g, (match) => {
    const num = parseFloat(match);
    return num.toFixed(2);
  });
}

/**
 * Runs inside the page:
 * - Finds JSON-LD script tags
 * - Looks for a Recipe object
 * - Returns { name, ingredients, instructions, imageUrl }
 */
function extractRecipeFromJsonLd() {
  const scripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  );

  const getImageUrl = (imageField) => {
    if (!imageField) return "";

    // image can be a string, object, or array of either
    if (typeof imageField === "string") return imageField;

    if (Array.isArray(imageField)) {
      const first = imageField[0];
      if (!first) return "";
      if (typeof first === "string") return first;
      if (typeof first === "object") {
        return first.url || first.contentUrl || "";
      }
      return "";
    }

    if (typeof imageField === "object") {
      return imageField.url || imageField.contentUrl || "";
    }

    return "";
  };

  for (const script of scripts) {
    let json;

    try {
      json = JSON.parse(script.textContent.trim());
    } catch (e) {
      continue;
    }

    const candidates = Array.isArray(json) ? json : [json];

    for (const node of candidates) {
      if (!node) continue;

      const type = node["@type"];
      const isRecipe =
        type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));

      if (!isRecipe) continue;

      const name = node.name || "";

      const ingredients = Array.isArray(node.recipeIngredient)
        ? node.recipeIngredient
        : [];

      let instructionsRaw = node.recipeInstructions ?? [];
      if (!Array.isArray(instructionsRaw)) {
        instructionsRaw = [instructionsRaw];
      }

      const instructions = instructionsRaw
        .map((step) => {
          if (!step) return null;
          if (typeof step === "string") return step;
          if (typeof step === "object") {
            if (step.text) return step.text;
            if (step.name) return step.name;
          }
          return null;
        })
        .filter(Boolean);

      const imageUrl = getImageUrl(node.image);

      return { name, ingredients, instructions, imageUrl };
    }
  }

  return null;
}

/**
 * Opens a new window with a printable recipe layout and triggers print.
 */
function openPrintWindow({ name, ingredients, instructions, imageUrl }) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const title = name || "Recipe";

  const doc = printWindow.document;
  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
              sans-serif;
            margin: 24px;
            line-height: 1.4;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 12px;
          }
          img {
            max-width: 200px;
            height: auto;
            display: block;
            margin-bottom: 16px;
            border-radius: 4px;
          }
          h2 {
            font-size: 18px;
            margin-top: 20px;
            margin-bottom: 8px;
          }
          ul, ol {
            margin-left: 22px;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        ${imageUrl ? `<img src="${imageUrl}" alt="">` : ""}
        <h2>Ingredients</h2>
        <ul>
          ${ingredients.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
        </ul>
        <h2>Instructions</h2>
        <ol>
          ${instructions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ol>
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  doc.close();
}

/**
 * Simple HTML escaping to avoid breaking the print window markup.
 */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}
