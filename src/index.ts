#!/usr/bin/env node

import path from "path";
import fs from "fs/promises";
import express from "express";
import cookieSession from "cookie-session";
import html from "@leafac/html";
import unified from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import hastUtilSanitize from "hast-util-sanitize";
// FIXME: https://github.com/syntax-tree/hast-util-sanitize/pull/21
const hastUtilSanitizeGitHubSchema = require("hast-util-sanitize/lib/github.json");
import deepMerge from "deepmerge";
import rehypeShiki from "@leafac/rehype-shiki";
import * as shiki from "shiki";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

type HTML = string;

async function appGenerator(): Promise<express.Express> {
  const app = express();

  app.set("version", require("../package.json").version);
  app.set("require", require);
  if (["development", "test"].includes(app.get("env"))) {
    app.set("url", "http://localhost:4000");
    app.set("administrator email", "development@courselore.org");
  }
  app.set(
    "layout base",
    (head: HTML, body: HTML): HTML =>
      html`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="generator"
              content="CourseLore/v${app.get("version")}"
            />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <link
              rel="icon"
              type="image/png"
              sizes="32x32"
              href="${app.get("url")}/favicon-32x32.png"
            />
            <link
              rel="icon"
              type="image/png"
              sizes="16x16"
              href="${app.get("url")}/favicon-16x16.png"
            />
            <link
              rel="shortcut icon"
              type="image/x-icon"
              href="${app.get("url")}/favicon.ico"
            />
            <!-- TODO: Remove unnecessary weights. -->
            $${[100, 200, 300, 400, 500, 600, 700, 800, 900].map(
              (weight) => html`<link
                rel="stylesheet"
                href="${app.get(
                  "url"
                )}/node_modules/@fontsource/public-sans/${weight}.css"
              />`
            )}
            $${[100, 200, 300, 400, 500, 600, 700].map(
              (weight) => html`<link
                rel="stylesheet"
                href="${app.get(
                  "url"
                )}/node_modules/@fontsource/roboto-mono/${weight}.css"
              />`
            )}
            <link
              rel="stylesheet"
              href="${app.get("url")}/node_modules/katex/dist/katex.min.css"
            />
            <style>
              /*
                https://pico-8.fandom.com/wiki/Palette
                #83769c
                #ff77a8
                #29adff
              */
              body {
                line-height: 1.5;
                font-family: "Public Sans", sans-serif;
                -webkit-text-size-adjust: 100%;
                margin: 0;
              }

              a {
                color: inherit;
              }

              a.undecorated,
              nav a {
                text-decoration: none;
              }

              code {
                font-family: "Roboto Mono", monospace;
              }

              ::selection {
                background-color: #ff77a8;
                color: white;
              }

              img,
              svg {
                max-width: 100%;
                height: auto;
              }

              h1 {
                line-height: 1.2;
                font-size: 1.5em;
                font-weight: 800;
                margin-top: 1.5em;
              }

              pre,
              .math-display {
                overflow: scroll;
              }

              pre {
                font-size: 0.75em;
                line-height: 1.3;
              }

              textarea {
                width: 100%;
                box-sizing: border-box;
                resize: vertical;
                font-size: 1em;
                background-color: white;
                border: 1px solid darkgray;
                border-radius: 10px;
                padding: 0.5em 0.7em;
                outline: none;
              }

              button,
              .button {
                font-size: 1em;
                font-weight: 700;
                text-decoration: none;
                background-color: #83769c;
                color: white;
                padding: 0.5em;
                border: none;
                border-radius: 10px;
                cursor: pointer;
              }
            </style>
            $${head}
          </head>
          <body>
            $${body}
          </body>
        </html>
      `.trimLeft()
  );
  app.set(
    "layout",
    (req: express.Request, head: HTML, body: HTML): HTML =>
      app.get("layout base")(
        head,
        html`
          <header
            style="
              display: grid;
              grid-template-columns: 1fr 2fr 1fr;
              align-items: center;
            "
          >
            <nav style="justify-self: start;">
              $${req.session?.user === undefined
                ? ""
                : html`
                    <button>
                      <svg width="20" height="20" viewBox="0 0 20 20">
                        <g
                          stroke="black"
                          stroke-width="2"
                          stroke-linecap="round"
                        >
                          <line x1="3" y1="5" x2="17" y2="5" />
                          <line x1="3" y1="10" x2="17" y2="10" />
                          <line x1="3" y1="15" x2="17" y2="15" />
                        </g>
                      </svg>
                    </button>
                  `}
            </nav>
            <nav style="justify-self: center;">
              <a href="${app.get("url")}" style="display: inline-flex;">
                $${logo}
                <span
                  style="
                    font-size: 1.5em;
                    font-weight: 900;
                    color: #83769c;
                    margin-left: 0.3em;
                  "
                  >CourseLore</span
                >
              </a>
            </nav>
            <nav style="justify-self: end;">
              $${req.session?.user === undefined
                ? ""
                : html`
                    <form method="post" action="${app.get("url")}/logout">
                      <button>Logout (${req.session!.user})</button>
                    </form>
                  `}
            </nav>
          </header>
          <main>$${body}</main>
          <footer></footer>
        `
      )
  );
  const logo = await fs.readFile(
    path.join(__dirname, "../public/logo.svg"),
    "utf-8"
  );
  app.set(
    "text processor",
    (text: string): HTML => textProcessor.processSync(text).toString()
  );
  const textProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(
      rehypeSanitize,
      deepMerge<hastUtilSanitize.Schema>(hastUtilSanitizeGitHubSchema, {
        attributes: {
          code: ["className"],
          span: [["className", "math-inline"]],
          div: [["className", "math-display"]],
        },
      })
    )
    .use(rehypeShiki, {
      highlighter: await shiki.getHighlighter({ theme: "light-plus" }),
    })
    .use(rehypeKatex, { maxSize: 25, maxExpand: 10 })
    .use(rehypeStringify);

  app.use(express.static(path.join(__dirname, "../public")));
  app.use(express.urlencoded({ extended: true }));

  app.get("/", (req, res) => {
    if (req.session?.user !== undefined)
      return res.redirect(app.get("url") + "/course");
    res.send(
      app.get("layout")(
        req,
        html`<title>CourseLore</title>`,
        html`
          <a class="button" href="${app.get("url")}/login?token=ali"
            >Login as Ali (Instructor)</a
          >
          <a class="button" href="${app.get("url")}/login?token=leandro"
            >Login as Leandro (Student)</a
          >
        `
      )
    );
  });

  app.get("/login", (req, res) => {
    const { token, redirect } = req.query;
    if (
      req.session?.user !== undefined ||
      (token !== "ali" && token !== "leandro") ||
      (redirect !== undefined && typeof redirect !== "string")
    )
      return res.sendStatus(400);
    req.session!.user = `${token}@courselore.org`;
    res.redirect(app.get("url") + (redirect ?? "/"));
  });

  app.post("/logout", (req, res) => {
    const { redirect } = req.query;
    if (
      req.session?.user === undefined ||
      (redirect !== undefined && typeof redirect !== "string")
    )
      return res.sendStatus(400);
    delete req.session!.user;
    res.redirect(app.get("url") + (redirect ?? "/"));
  });

  app.use((req, res, next) => {
    if (req.session?.user === undefined) return res.sendStatus(404);
    else next();
  });

  app.get("/course", (req, res) => {
    res.send(
      app.get("layout")(
        req,
        html`<title>Course · CourseLore</title>`,
        html`<a class="button" href="/thread">Go to thread</a>`
      )
    );
  });

  app
    .route("/thread")
    .get((req, res) => {
      res.send(
        app.get("layout")(
          req,
          html`<title>Thread · CourseLore</title>`,
          html`
            <ul>
              $${posts.map(
                ({ author, content, createdAt }) =>
                  html`<li>
                    ${author} says at ${createdAt}
                    $${app.get("text processor")(content)}
                  </li>`
              )}
            </ul>
            <form method="post">
              <p>
                <textarea name="text"></textarea><br /><button>Send</button>
              </p>
            </form>
          `
        )
      );
    })
    .post((req, res) => {
      posts.push({
        author: req.session!.user,
        content: req.body.text,
        createdAt: new Date().toISOString(),
      });
      res.redirect("back");
    });
  const posts: { author: string; content: string; createdAt: string }[] = [];

  return app;
}

export default appGenerator;

if (require.main === module)
  (async () => {
    const app = await appGenerator();

    console.log(`CourseLore\nVersion: ${app.get("version")}`);

    const CONFIGURATION_FILE = path.join(
      process.argv[2] ?? process.cwd(),
      "configuration.js"
    );
    try {
      await require(CONFIGURATION_FILE)(app);
      console.log(`Loaded configuration from ‘${CONFIGURATION_FILE}’`);
    } catch (error) {
      console.error(
        `Error: Failed to load configuration at ‘${CONFIGURATION_FILE}’: ${error.message}`
      );
      if (app.get("env") === "development") {
        const reverseProxy = express();
        reverseProxy.use(cookieSession({ secret: "development" }));
        reverseProxy.use(app);
        reverseProxy.listen(new URL(app.get("url")).port, () => {
          console.log(
            `Demonstration/Development web server started at ${app.get("url")}`
          );
        });
      }
    }

    const REQUIRED_SETTINGS = ["url", "administrator email"];
    const missingRequiredSettings = REQUIRED_SETTINGS.filter(
      (setting) => app.get(setting) === undefined
    );
    if (missingRequiredSettings.length > 0) {
      console.error(
        `Error: Missing the following required settings (did you set them on ‘${CONFIGURATION_FILE}’?): ${missingRequiredSettings
          .map((setting) => `‘${setting}’`)
          .join(", ")}`
      );
      process.exit(1);
    }
  })();
