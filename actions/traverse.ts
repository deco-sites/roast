// import * as cheerio from "https://deno.land/x/cheerio@1.0.7/mod.ts";
import cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

export async function get_page_content(page) {
  const title = await page.evaluate(() => {
    return document.title;
  });

  const html = await page.evaluate(() => {
    return document.body.innerHTML;
  });

  return "## START OF PAGE CONTENT ##\nTitle: " + title + "\n\n" +
    ugly_chowder(html) + "\n## END OF PAGE CONTENT ##";
}

export async function get_tabbable_elements(page, selector = "*") {
  let tabbable_elements = [];
  let skipped = [];
  let id = 0;

  let elements = await page.$$(
    'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), select:not([disabled]), a[href]:not([href="javascript:void(0)"]):not([href="#"]), dialog[open]',
  );

  let limit = 400;

  const ids: string[] = [];
  for (const element of elements) {
    if (--limit < 0) {
      break;
    }

    const next_tab = await get_next_tab(page, element, ++id, selector);

    if (next_tab !== false) {
      tabbable_elements.push(next_tab);
      ids.push(id.toString());
    }
  }

  return [tabbable_elements, ids];
}

async function get_next_tab(page, element, id, selector = "*") {
  let obj = await page.evaluate(
    async (element, id, selector) => {
      if (!element.matches(selector)) {
        return false;
      }

      const tagName = element.tagName;

      if (tagName === "BODY") {
        return false;
      }

      let textContent = element.textContent.replace(/\s+/g, " ").trim();

      if (textContent === "" && !element.matches("select, input, textarea")) {
        return false;
      }

      element.classList.add("pgpt-element" + id);

      let role = element.role;
      let placeholder = element.placeholder;
      let title = element.title;
      let type = element.type;
      let href = element.href;
      let value = element.value;

      if (href && href.length > 32) {
        href = href.substring(0, 32) + "[..]";
      }

      if (placeholder && placeholder.length > 32) {
        placeholder = placeholder.substring(0, 32) + "[..]";
      }

      if (!textContent && title && title.length > 32) {
        title = title.substring(0, 32) + "[..]";
      }

      if (textContent && textContent.length > 200) {
        textContent = textContent.substring(0, 200) + "[..]";
      }

      let tag = `<${tagName}`;

      if (href) tag += ` href="${href}"`;
      if (type) tag += ` type="${type}"`;
      if (placeholder) tag += ` placeholder="${placeholder}"`;
      if (title) tag += ` title="${title}"`;
      if (role) tag += ` role="${role}"`;
      if (value) tag += ` value="${value}"`;

      tag += `>`;

      let obj = {
        tag: tag,
        id: id,
      };

      if (textContent) {
        obj.text = textContent;
      }

      return obj;
    },
    element,
    id,
    selector,
  );

  if (!obj) {
    return false;
  }

  const visible = await page.evaluate(async (id) => {
    const element = document.querySelector(".pgpt-element" + id);

    if (!element) {
      return false;
    }

    const visibility = element.style.visibility;
    const display = element.style.display;
    const clip = element.style.clip;
    const rect = element.getBoundingClientRect();

    return (
      visibility !== "hidden" &&
      display !== "none" &&
      rect.width != 0 &&
      rect.height != 0 &&
      clip !== "rect(1px, 1px, 1px, 1px)" &&
      clip !== "rect(0px, 0px, 0px, 0px)"
    );
  }, id);

  if (!visible) {
    return false;
  } else {
    await page.evaluate(async (id) => {
      const element = document.querySelector(".pgpt-element" + id);
      element.setAttribute("pgpt-id", id);
      element.style.border = "1px solid red";
    }, id);
  }

  return obj;
}

function make_tag(element) {
  const $ = cheerio;

  let textContent = $(element).text().replace(/\s+/g, " ").trim();
  let placeholder = $(element).attr("placeholder");
  let tagName = element.name;
  let title = $(element).attr("title");
  let value = $(element).attr("value");
  let role = $(element).attr("role");
  let type = $(element).attr("type");
  let href = $(element).attr("href");
  let pgpt_id = $(element).attr("pgpt-id");

  if (href && href.length > 32) {
    href = href.substring(0, 32) + "[..]";
  }

  if (placeholder && placeholder.length > 32) {
    placeholder = placeholder.substring(0, 32) + "[..]";
  }

  if (title && title.length > 32) {
    title = title.substring(0, 32) + "[..]";
  }

  if (textContent && textContent.length > 200) {
    textContent = textContent.substring(0, 200) + "[..]";
  }

  let tag = `<${tagName}`;

  if (href) tag += ` href="${href}"`;
  if (type) tag += ` type="${type}"`;
  if (placeholder) tag += ` placeholder="${placeholder}"`;
  if (title) tag += ` title="${title}"`;
  if (role) tag += ` role="${role}"`;
  if (value) tag += ` value="${value}"`;
  if (pgpt_id) tag += ` pgpt-id="${pgpt_id}"`;

  tag += `>`;

  let obj = {
    tag: tag,
  };

  if (textContent) {
    obj.text = textContent;
    obj.tag += `${textContent}</${tagName}>`;
  }

  return obj;
}

function good_html(html) {
  html = html.replace(/<\//g, " </");
  let $ = cheerio.load(html);

  $("script, style").remove();

  let important = [
    "main",
    '[role="main"]',
    "#bodyContent",
    "#search",
    "#searchform",
    ".kp-header",
  ];

  // move important content to top
  important.forEach((im) => {
    $(im).each((i, el) => {
      $(el).prependTo("body");
    });
  });

  return $;
}

function ugly_chowder(html) {
  const $ = good_html("<body>" + html + "</body>");

  function traverse(element) {
    let output = "";
    let children = element.children;

    if ($(element).is("h1, h2, h3, h4, h5, h6")) {
      output += "<" + element.name + ">";
    }

    if ($(element).is("form")) {
      output += "\n<" + element.name + ">\n";
    }

    if ($(element).is("div, section, main")) {
      output += "\n";
    }

    let the_tag = make_tag(element);

    if ($(element).attr("pgpt-id")) {
      output += " " + (the_tag.tag ? the_tag.tag : "");
    } else if (element.type === "text" && !$(element.parent).attr("pgpt-id")) {
      output += " " + element.data.trim();
    }

    if (children) {
      children.forEach((child) => {
        output += traverse(child);
      });
    }

    if ($(element).is("h1, h2, h3, h4, h5, h6")) {
      output += "</" + element.name + ">";
    }

    if ($(element).is("form")) {
      output += "\n</" + element.name + ">\n";
    }

    if ($(element).is("h1, h2, h3, h4, h5, h6, div, section, main")) {
      output += "\n";
    }

    return output.replace(/[^\S\n]+/g, " ").replace(/ \n+/g, "\n").replace(
      /[\n]+/g,
      "\n",
    );
  }

  return traverse($("body")[0]);
}
