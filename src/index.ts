#!/usr/bin/env node

import process from "process";
import path from "path";
import fs from "fs/promises";

import express from "express";
import * as expressValidator from "express-validator";

import { Database, sql } from "@leafac/sqlite";
import databaseMigrate from "@leafac/sqlite-migration";

import html from "@leafac/html";
import javascript from "tagged-template-noop";

import unified from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import hastUtilSanitize from "hast-util-sanitize";
import deepMerge from "deepmerge";
import rehypeShiki from "@leafac/rehype-shiki";
import * as shiki from "shiki";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

import shell from "shelljs";

// FIXME: Update Node and use crypto.randomInt()
import cryptoRandomString from "crypto-random-string";

import inquirer from "inquirer";

import prettier from "prettier";

type HTML = string;

async function appGenerator(): Promise<express.Express> {
  const app = express();

  app.set(
    "version",
    JSON.parse(
      await fs.readFile(path.join(__dirname, "../package.json"), "utf-8")
    ).version
  );
  app.set("require", require);
  app.set("root path", process.argv[2] ?? process.cwd());
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
            <meta name="generator" content="CourseLore/${app.get("version")}" />
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
            <link
              rel="stylesheet"
              href="${app.get(
                "url"
              )}/node_modules/typeface-public-sans/index.css"
            />
            <link
              rel="stylesheet"
              href="${app.get(
                "url"
              )}/node_modules/typeface-roboto-mono/index.css"
            />
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
                max-width: 600px;
                margin: 1em auto;
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

              .TODO {
                font-size: 0.875em;
                background-color: whitesmoke;
                box-sizing: border-box;
                padding: 0 1em;
                border: 1px solid darkgray;
                border-radius: 10px;
              }

              /*
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
              */
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
              <!--$${req.session!.email === undefined
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
                  `}-->
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
              $${req.session!.email === undefined
                ? ""
                : html`
                    <form method="post" action="${app.get("url")}/logout">
                      <button>Logout (${req.session!.email})</button>
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
      deepMerge<hastUtilSanitize.Schema>(
        JSON.parse(
          await fs.readFile(
            require.resolve("hast-util-sanitize/lib/github.json"),
            "utf-8"
          )
        ),
        {
          attributes: {
            code: ["className"],
            span: [["className", "math-inline"]],
            div: [["className", "math-display"]],
          },
        }
      )
    )
    .use(rehypeShiki, {
      highlighter: await shiki.getHighlighter({ theme: "light-plus" }),
    })
    .use(rehypeKatex, { maxSize: 25, maxExpand: 10 })
    .use(rehypeStringify);

  app.use(express.static(path.join(__dirname, "../public")));
  app.use(express.urlencoded({ extended: true }));

  const unauthenticatedRoutes = express.Router();

  unauthenticatedRoutes.get("/", (req, res) => {
    res.send(
      app.get("layout")(
        req,
        html`<title>CourseLore</title>`,
        html`
          <a href="${app.get("url")}/sign-in">Sign in</a>
          <a href="${app.get("url")}/sign-up">Sign up</a>
        `
      )
    );
  });

  unauthenticatedRoutes.get("/sign-up", (req, res) => {
    res.send(
      app.get("layout")(
        req,
        html`<title>Sign up · CourseLore</title>`,
        html`
          <h1>Sign up to CourseLore</h1>
          <form method="post" action="${app.get("url")}/authenticate">
            <input
              name="email"
              type="email"
              placeholder="me@university.edu"
              required
            />
            <button>Continue</button>
          </form>
          <p>
            <small>
              Already have an account?
              <a href="${app.get("url")}/sign-in">Sign in</a>.
            </small>
          </p>
        `
      )
    );
  });

  // FIXME: Make more sophisticated use of expressValidator.
  unauthenticatedRoutes.post(
    "/authenticate",
    expressValidator.body("email").isEmail(),
    (req, res) => {
      const errors = expressValidator.validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(errors.array());

      const { email } = req.body;

      runtimeDatabase.run(
        sql`DELETE FROM authenticationTokens WHERE email = ${email}`
      );
      const token = newToken(20);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      runtimeDatabase.run(
        sql`INSERT INTO authenticationTokens (token, email, expiresAt) VALUES (${token}, ${email}, ${expiresAt.toISOString()})`
      );

      if (
        database.get<{ userExists: number }>(
          sql`SELECT EXISTS(SELECT 1 FROM users WHERE email = ${email}) AS userExists`
        )!.userExists === 1
      ) {
        const magicLink = `${app.get("url")}/sign-in/${token}`;
        return res.send(
          app.get("layout")(
            req,
            html`<title>Sign in · CourseLore</title>`,
            html`
              <p>
                You already have a CourseLore account! We sent you an email to
                sign in.
              </p>
              <p>
                <strong>
                  Please check your email and click on the magic link to
                  continue.
                </strong>
              </p>
              <form method="post" action="${app.get("url")}/sign-up">
                <input type="hidden" name="email" value="${email}" />
                <p>
                  <small>
                    Can’t find the email? <button>Resend</button>.
                  </small>
                </p>
              </form>
              <div class="TODO">
                <p>
                  At this point CourseLore would have sent you an email, but
                  this is only an early-stage demonstration and we want to make
                  your life easier, so here’s what you’d find in that email
                  instead:
                </p>
                <p><strong>From:</strong><br />CourseLore</p>
                <p>
                  <strong>Subject:</strong><br />Here’s your sign-in magic link
                </p>
                <p>
                  <strong>Body:</strong><br />
                  <a href="${magicLink}">${magicLink}</a><br />
                  <small>
                    Expires in 10 minutes (${expiresAt.toISOString()}).
                  </small>
                </p>
              </div>
            `
          )
        );
      }

      const magicLink = `${app.get("url")}/sign-up/${token}`;
      res.send(
        app.get("layout")(
          req,
          html`<title>Sign up · CourseLore</title>`,
          html`
            <p>
              At this point CourseLore would send you an email with a magic link
              for signing up, but because this is only an early-stage
              demonstration, here’s the magic link instead (valid until
              ${expiresAt.toISOString()}):<br />
              <a href="${magicLink}">${magicLink}</a><br />
            </p>
          `
        )
      );
    }
  );

  app.use((req, res, next) => {
    if (req.session!.email === undefined) next();
    else next("route");
  }, unauthenticatedRoutes);

  const authenticatedRoutes = express.Router();

  app.use((req, res, next) => {
    if (req.session!.email !== undefined) next();
    else next("route");
  }, authenticatedRoutes);

  /*

  app.post("/login", expressValidator.body("email").isEmail(), (req, res) => {
    const errors = expressValidator.validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(errors.array());
    const { email } = req.body;
    database.run(sql`DELETE FROM authenticationTokens WHERE email = ${email}`);
    const token = newToken(20);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    database.run(
      sql`INSERT INTO authenticationTokens (token, email, expiresAt) VALUES (${token}, ${email}, ${expiresAt.toISOString()})`
    );
    const magicLink = `${app.get("url")}/login/${token}`;
    return res.send(
      app.get("layout")(
        req,
        html`<title>Login · CourseLore</title>`,
        html`
          <p>
            At this point CourseLore would send you an email with a magic link
            for login, but because this is only an early-stage demonstration,
            here’s the magic link instead (valid until
            ${expiresAt.toISOString()}):<br />
            <a href="${magicLink}">${magicLink}</a><br />
          </p>
        `
      )
    );
  });

  app.get("/login/:token", (req, res) => {
    const { token } = req.params;
    const authenticationToken = database.get<{
      email: string;
      expiresAt: string;
    }>(
      sql`SELECT email, expiresAt FROM authenticationTokens WHERE token = ${token}`
    );
    if (
      authenticationToken === undefined ||
      new Date(authenticationToken.expiresAt) < new Date()
    )
      return res.send(
        app.get("layout")(
          req,
          html`<title>Login · CourseLore</title>`,
          html`
            <p>
              Invalid or expired magic link.
              <a href="${app.get("url")}/login">Try logging in again</a>
            </p>
          `
        )
      );
    database.run(sql`DELETE FROM authenticationTokens WHERE token = ${token}`);
    const { email } = authenticationToken;
    const isNewUser =
      database.get<{ output: number }>(
        sql`SELECT EXISTS(SELECT 1 FROM users WHERE email = ${email}) AS output`
      ).output === 0;
    if (isNewUser) {
      const token = newToken(20);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      database.run(
        sql`INSERT INTO authenticationTokens (token, email, expiresAt) VALUES (${token}, ${email}, ${expiresAt.toISOString()})`
      );
      return res.send(
        app.get("layout")(
          req,
          html`<title>Sign up · CourseLore</title>`,
          html`
            <p>Welcome to CourseLore!</p>
            <form method="post" action="${app.get("url")}/users">
              <input type="hidden" name="token" value="${token}" />
              <label>Name: <input type="text" name="name" /></label>
              <button>Create account</button>
            </form>
          `
        )
      );
    }
    req.session!.email = authenticationToken.email;
    res.redirect(`${app.get("url")}/`);
  });

  app.post(
    "/users",
    expressValidator.body("token").exists(),
    expressValidator.body("name").exists(),
    (req, res) => {
      const errors = expressValidator.validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(errors.array());
      const { token, name } = req.body;
      const authenticationToken = database.get<{
        email: string;
        expiresAt: string;
      }>(
        sql`SELECT email, expiresAt FROM authenticationTokens WHERE token = ${token}`
      );
      if (
        authenticationToken === undefined ||
        new Date(authenticationToken.expiresAt) < new Date()
      )
        return res.send(
          app.get("layout")(
            req,
            html`<title>Sign up · CourseLore</title>`,
            html`
              <p>
                Invalid or expired magic link.
                <a href="${app.get("url")}/login">Try signing up again</a>
              </p>
            `
          )
        );
      database.run(
        sql`DELETE FROM authenticationTokens WHERE token = ${token}`
      );
      const { email } = authenticationToken;
      const isNewUser =
        database.get<{ output: number }>(
          sql`SELECT EXISTS(SELECT 1 FROM users WHERE email = ${email}) AS output`
        ).output === 0;
      if (!isNewUser)
        return res.status(400).send(
          app.get("layout")(
            req,
            html`<title>Sign up · CourseLore</title>`,
            html`
              <p>
                There already is an account with that email.
                <a href="${app.get("url")}/login">Try just logging in</a>
              </p>
            `
          )
        );
      database.run(
        sql`INSERT INTO users (email, name) VALUES (${email}, ${name})`
      );
      req.session!.email = authenticationToken.email;
      res.redirect(`${app.get("url")}/`);
    }
  );

  app.post("/logout", (req, res) => {
    delete req.session!.email;
    res.redirect(`${app.get("url")}/`);
  });

  app.use((req, res, next) => {
    if (req.session!.email === undefined) return res.sendStatus(404);
    else next();
  });

  app.get("/", (req, res) => {
    res.send(
      app.get("layout")(
        req,
        html`<title>CourseLore</title>`,
        html`
          <p>
            TODO: If you aren’t in any courses, say welcome message and
            encourage you to join/create a course. If you’re in only one course,
            redirect to it. If you’re in multiple courses, show an aggregate
            feed of the activities in all courses.
          </p>
        `
      )
    );
  });

  /*
  app.get("/course", (req, res) => {
    res.send(
      app.get("layout")(
        req,
        html`<title>Course · CourseLore</title>`,
        html`<a class="button" href="/thread">Go to thread</a>`
      )
    );
  });

  app.get("/thread", (req, res) => {
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
            <p><textarea name="text"></textarea><br /><button>Send</button></p>
          </form>
        `
      )
    );
  });
  app.post("/thread", (req, res) => {
    posts.push({
      author: req.session!.email,
      content: req.body.text,
      createdAt: new Date().toISOString(),
    });
    res.redirect("back");
  });
  const posts: { author: string; content: string; createdAt: string }[] = [];
  */

  // FIXME: Open the databases using smarter configuration, for example, WAL and PRAGMA foreign keys.
  shell.mkdir("-p", path.join(app.get("root path"), "data"));
  const database = new Database(
    app.get("env") === "test"
      ? ":memory:"
      : path.join(app.get("root path"), "data/courselore.db")
  );
  databaseMigrate(database, [
    sql`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      );

      CREATE TABLE courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      );

      CREATE TABLE enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user INTEGER NOT NULL REFERENCES users,
        course INTEGER NOT NULL REFERENCES courses,
        role TEXT NOT NULL,
        UNIQUE (user, course)
      );
    `,
  ]);
  shell.mkdir("-p", path.join(app.get("root path"), "tmp"));
  const runtimeDatabase = new Database(
    app.get("env") === "test"
      ? ":memory:"
      : path.join(app.get("root path"), "tmp/courselore-runtime.db")
  );
  databaseMigrate(database, [
    sql`
      CREATE TABLE authenticationTokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        expiresAt TEXT NOT NULL
      );
    `,
  ]);

  function newToken(length: number): string {
    return cryptoRandomString({ length, characters: "cfhjkprtvwxy3479" });
  }

  return app;
}

export default appGenerator;

if (require.main === module)
  (async () => {
    const app = await appGenerator();

    console.log(`CourseLore\nVersion: ${app.get("version")}`);

    app.set("configuration", path.join(app.get("root path"), "courselore.js"));

    try {
      (await import(app.get("configuration"))).default(app);
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") {
        console.error(
          `Failed to load configuration from ‘${app.get(
            "configuration"
          )}’ (probably there’s a problem with your configuration): ${
            error.message
          }`
        );
        process.exit(1);
      }
      if (
        (
          await inquirer.prompt([
            {
              type: "list",
              name: "answer",
              message: `There’s no configuration file at ‘${app.get(
                "configuration"
              )}’, what would you like to do?`,
              choices: [
                `Create a configuration file at ‘${app.get("configuration")}’`,
                "Exit",
              ],
            },
          ])
        ).answer == "Exit"
      )
        process.exit();
      switch (
        (
          await inquirer.prompt([
            {
              type: "list",
              name: "answer",
              message:
                "What kind of configuration file would you like to create?",
              choices: ["Demonstration/Development", "Production"],
            },
          ])
        ).answer
      ) {
        case "Demonstration/Development":
          const url = (
            await inquirer.prompt([
              {
                name: "answer",
                message: `What URL would you like to use to access the application (for example, to test on your computer, the URL may be http://localhost:4000; and to test on your network, for example on your phone, the URL may be http://<your-machine-name>.local:4000)?`,
                default: "http://localhost:4000",
              },
            ])
          ).answer;
          await fs.writeFile(
            app.get("configuration"),
            prettier.format(
              javascript`
                module.exports = (app) => {
                  const courseloreRequire = app.get("require");
                  const express = courseloreRequire("express");
                  const cookieSession = courseloreRequire("cookie-session");

                  app.set("url", "${url}")
                  app.set("administrator email", "demonstration-development@courselore.org")

                  const reverseProxy = express();
                
                  reverseProxy.use(cookieSession({ secret: "demonstration/development" }));
                  reverseProxy.use(app);
                
                  reverseProxy.listen(new URL(app.get("url")).port, () => {
                    console.log(\`Demonstration/Development web server started at \${app.get("url")}\`);
                  });
                };
              `,
              { parser: "babel" }
            )
          );
          console.log(
            `Created configuration file at ‘${app.get("configuration")}’`
          );
          (await import(app.get("configuration"))).default(app);
          break;
        case "Production":
          console.error("TODO");
          process.exit(1);
          break;
      }
    }
  })();
