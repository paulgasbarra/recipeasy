document.addEventListener("DOMContentLoaded", () => {
  init();
});

// Global state
let originalIngredients = [];
let currentUnitSystem = "US"; // "US" or "Metric"

async function init() {
  const statusEl = document.getElementById("status");
  const titleEl = document.getElementById("recipeTitle");
  const authorsEl = document.getElementById("recipeAuthors");
  const siteEl = document.getElementById("recipeSite");
  const ingredientsList = document.getElementById("ingredientsList");
  const instructionsList = document.getElementById("instructionsList");
  const imageEl = document.getElementById("recipeImage");
  const printButton = document.getElementById("printButton");
  const convertButton = document.getElementById("convertMeasurements");

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

    const {
      name,
      ingredients,
      instructions,
      imageUrl,
      author,
      publisher,
      siteUrl,
    } = data;

    // Store original ingredients
    originalIngredients = [...ingredients];
    currentUnitSystem = "US";

    // Render title
    statusEl.textContent = "";
    if (name) {
      titleEl.textContent = name;
    }

    // Render author
    if (author) {
      authorsEl.textContent = `By ${author}`;
      authorsEl.style.display = "block";
    } else {
      authorsEl.style.display = "none";
    }

    // Render site/publisher link
    if (publisher && siteUrl) {
      siteEl.innerHTML = `<a href="${escapeHtml(
        siteUrl
      )}" target="_blank">${escapeHtml(publisher)}</a>`;
      siteEl.style.display = "block";
    } else if (siteUrl) {
      siteEl.innerHTML = `<a href="${escapeHtml(
        siteUrl
      )}" target="_blank">View Original Recipe</a>`;
      siteEl.style.display = "block";
    } else {
      siteEl.style.display = "none";
    }

    // Render image
    if (imageUrl) {
      imageEl.src = imageUrl;
      imageEl.style.display = "block";
    } else {
      imageEl.style.display = "none";
    }

    // Render ingredients
    renderIngredients(ingredientsList, ingredients);

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
      openPrintWindow({
        name,
        ingredients: getCurrentIngredients(),
        instructions,
        imageUrl,
        author,
        publisher,
        siteUrl,
      });
    });

    // Enable convert button
    convertButton.disabled = false;
    convertButton.addEventListener("click", () => {
      toggleUnitSystem(ingredientsList, convertButton);
    });
  } catch (err) {
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
 * Renders the ingredients list
 */
function renderIngredients(ingredientsList, ingredients) {
  ingredientsList.innerHTML = "";
  ingredients.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = roundDecimalsInText(item);
    ingredientsList.appendChild(li);
  });
}

/**
 * Gets the current ingredients (converted if needed)
 */
function getCurrentIngredients() {
  if (currentUnitSystem === "US") {
    return originalIngredients;
  } else {
    return originalIngredients.map((ingredient) => convertToMetric(ingredient));
  }
}

/**
 * Toggles between US and Metric units
 */
function toggleUnitSystem(ingredientsList, convertButton) {
  if (currentUnitSystem === "US") {
    // Convert to Metric
    currentUnitSystem = "Metric";
    const convertedIngredients = originalIngredients.map((ingredient) =>
      convertToMetric(ingredient)
    );
    renderIngredients(ingredientsList, convertedIngredients);
    convertButton.textContent = "Convert to US";
    convertButton.title = "Convert to US";
  } else {
    // Convert back to US
    currentUnitSystem = "US";
    renderIngredients(ingredientsList, originalIngredients);
    convertButton.textContent = "Convert to Metric";
    convertButton.title = "Convert to Metric";
  }
}

/**
 * Parses a number that might be a fraction, decimal, or mixed number
 * Examples: "1/2" -> 0.5, "1 1/2" -> 1.5, "2.5" -> 2.5, "3" -> 3
 */
function parseAmount(amountStr) {
  // Trim whitespace
  amountStr = amountStr.trim();

  // Check for mixed number (e.g., "1 1/2")
  const mixedMatch = amountStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    return whole + numerator / denominator;
  }

  // Check for fraction (e.g., "1/2")
  const fractionMatch = amountStr.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    return numerator / denominator;
  }

  // Otherwise parse as decimal
  return parseFloat(amountStr);
}

/**
 * Converts US units to Metric in ingredient text
 */
function convertToMetric(ingredient) {
  let converted = ingredient;

  // Conversion patterns (case-insensitive)
  // Updated to capture fractions, mixed numbers, and decimals
  const conversions = [
    // Cups to ml (1 cup = 240ml)
    {
      pattern: /(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)\s*cups?/gi,
      convert: (amt) => `${Math.round(amt * 240)} ml`,
    },

    // Tablespoons to ml (1 tbsp = 15ml)
    {
      pattern:
        /(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)\s*(?:tablespoons?|tbsp?s?|T)\b/gi,
      convert: (amt) => `${Math.round(amt * 15)} ml`,
    },

    // Teaspoons to ml (1 tsp = 5ml)
    {
      pattern:
        /(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)\s*(?:teaspoons?|tsps?|t)\b/gi,
      convert: (amt) => `${Math.round(amt * 5)} ml`,
    },

    // Fluid ounces to ml (1 fl oz = 30ml)
    {
      pattern:
        /(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)\s*(?:fluid\s*ounces?|fl\.?\s*oz\.?)/gi,
      convert: (amt) => `${Math.round(amt * 30)} ml`,
    },

    // Ounces to grams (1 oz = 28g)
    {
      pattern:
        /(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)\s*(?:ounces?|oz\.?)(?!\s*fluid)/gi,
      convert: (amt) => `${Math.round(amt * 28)} g`,
    },

    // Pounds to grams (1 lb = 454g)
    {
      pattern: /(\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+)\s*(?:pounds?|lbs?\.?)/gi,
      convert: (amt) => `${Math.round(amt * 454)} g`,
    },

    // Fahrenheit to Celsius
    {
      pattern: /(\d+)\s*°?F\b/gi,
      convert: (amt) => `${Math.round(((amt - 32) * 5) / 9)}°C`,
    },
  ];

  conversions.forEach(({ pattern, convert }) => {
    converted = converted.replace(pattern, (match, amount) => {
      const num = parseAmount(amount);
      return convert(num);
    });
  });

  return converted;
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

      // Extract author information
      let author = "";
      if (node.author) {
        if (typeof node.author === "string") {
          author = node.author;
        } else if (typeof node.author === "object") {
          author = node.author.name || "";
        } else if (Array.isArray(node.author) && node.author.length > 0) {
          const firstAuthor = node.author[0];
          author =
            typeof firstAuthor === "string"
              ? firstAuthor
              : firstAuthor.name || "";
        }
      }

      // Extract site/publisher information and URL
      let publisher = "";
      let siteUrl = "";
      if (node.publisher) {
        if (typeof node.publisher === "string") {
          publisher = node.publisher;
        } else if (typeof node.publisher === "object") {
          publisher = node.publisher.name || "";
          siteUrl = node.publisher.url || "";
        }
      }

      // If no siteUrl from publisher, try to get from mainEntityOfPage or url
      if (!siteUrl) {
        if (node.mainEntityOfPage) {
          siteUrl =
            typeof node.mainEntityOfPage === "string"
              ? node.mainEntityOfPage
              : node.mainEntityOfPage["@id"] || "";
        } else if (node.url) {
          siteUrl = node.url;
        }
      }

      // If still no siteUrl, use current page URL
      if (!siteUrl) {
        siteUrl = window.location.href;
      }

      return {
        name,
        ingredients,
        instructions,
        imageUrl,
        author,
        publisher,
        siteUrl,
      };
    }
  }

  return null;
}

/**
 * Opens a new window with a printable recipe layout and triggers print.
 */
function openPrintWindow({
  name,
  ingredients,
  instructions,
  imageUrl,
  author,
  publisher,
  siteUrl,
}) {
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
            margin-bottom: 8px;
            margin-top: 0;
          }
          .recipe-meta {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
          }
          .recipe-meta a {
            color: #0066cc;
            text-decoration: none;
          }
          .recipe-meta a:hover {
            text-decoration: underline;
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
        ${
          author
            ? `<div class="recipe-meta">By ${escapeHtml(author)}</div>`
            : ""
        }
        ${
          publisher && siteUrl
            ? `<div class="recipe-meta">Source: <a href="${escapeHtml(
                siteUrl
              )}" target="_blank">${escapeHtml(publisher)}</a></div>`
            : siteUrl
            ? `<div class="recipe-meta">Source: <a href="${escapeHtml(
                siteUrl
              )}" target="_blank">View Original</a></div>`
            : ""
        }
        ${imageUrl ? `<img src="${imageUrl}" alt="">` : ""}
        <h2>Ingredients</h2>
        <ul>
          ${ingredients.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
        </ul>
        <h2>Instructions</h2>
        <ol>
          ${instructions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ol>
      </body>
    </html>
  `);
  doc.close();

  // Give the new window a moment to render, then print.
  // (You can tweak the timeout if needed.)
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 100);
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
