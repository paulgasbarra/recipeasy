# 🍲 Recipeasy — A Minimalist Chrome Extension for Clean Recipe Extraction

Recipeasy is a lightweight Chrome extension that extracts **publicly available JSON-LD recipe metadata** (title, image, ingredients, and instructions) from any webpage and displays it in a clean, scrollable, and printable format.

Many recipe sites bury structured data behind extended text, layers of pop-ups, ads, and scripts.  
This extension simply surfaces the recipe metadata already published for SEO, giving users a clear view of what they’re cooking — no scraping, no paywall bypassing, no content redistribution.


https://github.com/user-attachments/assets/e3b22c18-0018-464c-8ccf-121ee41ebfe6


---

## ✨ Features

- 🔍 **Automatic JSON-LD detection**  
  Works on any site that publishes a `<script type="application/ld+json">` recipe block.

- 🍽 **Extracts:**

  - Recipe title
  - Main photo (if available)
  - Ingredient list
  - Step-by-step instructions

- 🇺🇸/🇬🇧 **Converts from US to Metric**\
  One click turns cups to grams for precision cooking.

- 🖨 **One-click Print Mode**  
  Opens a clean, typography-friendly print layout with the recipe nicely formatted.

- 📜 **Sticky header + scrollbar**  
  The recipe title, conversion button, and print button stay visible while scrolling.

- 💻 **All processing happens locally**  
  No servers, no analytics, no data collection.

---

## 🚀 Installation (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and visit: chrome://extensions
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked**.
5. Select this project folder.

The extension icon will appear in your toolbar.  
Navigate to a recipe site, click the icon, and voilà — clean recipe view.

---

## 🧠 How It Works

Recipeasy looks for:

```html
<script type="application/ld+json">
  ...
</script>
```

If it contains a "@type": "Recipe" block, the extension:

Parses the JSON-LD

Extracts standard schema.org fields

Displays them in the popup UI

Allows printing via a custom print template

It does not scrape HTML or bypass paywalls.
It only reads structured metadata explicitly exposed by the website.

Sites it works on:

- [Babish Culinary Universe](https://www.babi.sh/)
- [Allrecipes](https://www.allrecipes.com/)
- [Food Network](https://www.foodnetwork.com/)
- [Serious Eats](https://www.seriouseats.com/)
- [Simply Recipes](https://www.simplyrecipes.com/)
- [Epicurious](https://www.epicurious.com/)
- [NYT Cooking](https://cooking.nytimes.com/)
- [America's Test Kitchen](https://www.americastestkitchen.com/)
- and many more.

---

🔒 Disclaimer

This project is not affiliated with or endorsed by any recipe website including any of the ones listed above.

Recipeasy:

Does not store or redistribute copyrighted recipe content

Does not circumvent paywalls

Only displays structured metadata that websites voluntarily publish for SEO

Users are responsible for complying with the content policies of each site.

All recipe copyrights belong to their respective owners.

---

🧑‍🍳 Motivation

I built this extension because I love cooking — and I love clean data.

So many recipe sites publish beautifully structured JSON-LD behind the scenes that never makes it to the user’s eyes. This extension is a simple way to reveal that data and make cooking easier.

---

🌟 Future Ideas (PRs welcome!)

Ingredient normalization & scaling (2x, ½x)

Grocery list generation

Dark mode

AI-assisted recipe summaries or substitutions
