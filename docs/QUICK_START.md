# Quick Start: Put your family archive online

Kindred gives your family a website with one shared password. You maintain names, relationships, and photo references in files; the website does not have an editing screen.

Choose one option:

| Option | Where family files live | Best fit |
| --- | --- | --- |
| [A. Vercel with a private GitHub repository](#a-vercel-with-a-private-github-repository) | In your private GitHub copy, then copied into the website when it is built | The simplest online setup |
| [B. Vercel with Private Blob](#b-vercel-with-private-blob) | In Vercel's separate private file storage | Keep real family files out of the application repository |
| [C. Your own server](#c-your-own-server) | On a computer/server you manage | You already have someone who manages a server |

“Local” storage means **files on the computer running the website**. It can mean a Vercel server, your own server, or your computer. “Blob” means Vercel's separate file storage.

Start with the included fictional family if you want to learn the steps first. See [the data guide](DATA_SCHEMA.md) when you are ready to enter real records. The [README](../README.md) has more technical detail.

## Before you begin

- Keep any GitHub repository containing real family files **Private**.
- Never put family files or photographs in the application's `public/` folder.
- Keep passwords and access keys out of GitHub, including private repositories.
- Anyone who knows the shared password can view and download the archive. Give it only to people you trust.

GitHub stores your application files. Vercel runs the website. A private GitHub repository does not, by itself, protect the website; the family password controls website access.

## Make your own private GitHub copy

You can reuse an existing private copy. Otherwise, these steps use [GitHub Desktop](https://desktop.github.com/) on Windows or macOS:

1. On the original application's GitHub page, choose **Code → Download ZIP**. Unzip it on your computer.
2. Install GitHub Desktop and sign in to your GitHub account.
3. Choose **File → New repository**. Name it `my-kindred-family` and choose where to save it. Leave the optional README, license, and ignore-file selections empty; the application already includes those files.
4. Open the new folder. Copy the **contents** of the unzipped application into it. `package.json` must be directly inside `my-kindred-family`, not inside another folder. Include hidden files such as `.gitignore`, `.env.example`, and the `.devcontainer` folder. To show hidden files, use **View → Show → Hidden items** in Windows File Explorer or **Command + Shift + .** in macOS Finder.
5. In GitHub Desktop, enter a short description such as “Copy Kindred application” and click **Commit to main**. A “commit” saves a version of your files.
6. Click **Publish repository**, keep **Keep this code private** selected, and publish.
7. Open the repository on GitHub and check that **Private** appears beside its name before adding real family records.

GitHub's [Desktop setup guide](https://docs.github.com/en/desktop/overview/creating-your-first-repository-using-github-desktop) explains these controls. Publishing here uploads your code to GitHub; it does not yet create the website.

## The settings both Vercel options need

Vercel calls these settings **environment variables**. Each has a name and a value. Enter them in Vercel, not in a file uploaded to GitHub.

| Name | Value to enter |
| --- | --- |
| `FAMILY_PASSWORD` | A strong password you will share with family |
| `AUTH_SECRET` | A separate random secret used by the website; do not share it with visitors |
| `FAMILY_DATA_PROVIDER` | `local` for option A; `blob` for option B |

For `AUTH_SECRET`, use a password manager to generate a random 64-character value. If you already have Node.js installed, this command also generates a suitable value:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Copy the result into Vercel and save it privately. Do not rename these settings or add `NEXT_PUBLIC_` to their names.

## A. Vercel with a private GitHub repository

### 1. Put the family files in GitHub

In **your private repository**, use these locations:

| File | Where to put it |
| --- | --- |
| People records | `private-data/people.json`, replacing the fictional records |
| Relationship records | `private-data/relationships.json`, replacing the fictional records |
| Archive title and starting people | Edit the existing `private-data/config.ts` |
| Photographs | Inside `private-media/`; for example `private-media/portraits/p0012.webp` |

On GitHub, open the destination folder and choose **Add file → Upload files**. Upload the replacement files and save the change. To change `config.ts`, open it and use the pencil/edit control. If GitHub asks you to propose a change instead, finish it by merging the change into the main branch. See GitHub's [file-upload guide](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

For the photo example, drag the `portraits` folder containing your image into the upload page for `private-media/`.

Keep the `import "server-only";` line in `config.ts`. Change the title/subtitle and set `isDemo` to `false` for real data. Set `featured` to IDs in your records, or use `[]` to let the application choose a starting person.

For a photo at `private-media/portraits/p0012.webp`, its entry in the person's JSON uses `"file": "portraits/p0012.webp"`. Keep filenames exactly the same, including capital letters. Supported formats are JPG, JPEG, PNG, WebP, and AVIF. Photos are optional. [Photo entry examples](DATA_SCHEMA.md#photos).

### 2. Create the Vercel website

1. Sign in to Vercel. Choose **Add New → Project**.
2. Connect GitHub if asked, allow Vercel to access your private repository, and select **Import** beside `my-kindred-family`.
3. Use **Next.js** as the framework. The application folder containing `package.json` is the project root. Keep the default output setting. If asked for commands, use `npm ci` to install and `npm run build` to build.
4. Add the three environment variables above, using `FAMILY_DATA_PROVIDER=local`. Choose **Production** for the live website. Enable **Preview** only if you want additional test websites to access this archive too.
5. Click **Deploy**. In project settings, use Node.js **22.x**. If you change settings after the first deployment, open **Deployments**, choose the latest deployment, and use **Redeploy**.
6. When Vercel reports **Ready**, open the website address and enter the family password.

Vercel documents [project import](https://vercel.com/docs/projects/managing-projects) and [environment settings](https://vercel.com/docs/environment-variables).

**Later changes:** upload/edit files in the private repository's main branch. With the GitHub connection enabled, Vercel builds a new version automatically. Wait for it to become Ready, then refresh the website. You do not upload these family files separately into Vercel Storage for this option.

## B. Vercel with Private Blob

This option has an extra upload step. The application code can stay on GitHub with only fictional records; real records and photos live in a separate **Private** Blob store. You can still use the private GitHub copy described above.

### 1. Create the website and storage

1. Follow option A's **Create the Vercel website** steps, but set `FAMILY_DATA_PROVIDER=blob`. Keep the GitHub family files fictional. Until storage is ready, login may work while the archive displays a loading error.
2. In the Vercel project's **Storage** tab, choose **Create Storage → Blob**. Select **Private**, give the store a name, and create it.
3. In the store's **Projects** tab, connect it to this website. Select **Production** for the live website. Add **Development** only if you use the optional command-line uploads below. Enable Preview only if needed.
4. Check the project's environment settings for the connected store's `BLOB_STORE_ID`. Vercel manages its own temporary access credentials; you do not need to invent or share them. Redeploy after connecting the store.

See Vercel's [store setup and connection guide](https://vercel.com/docs/vercel-blob/using-blob-sdk#getting-started). **Private** is essential; a Public store is unsuitable for family files.

### 2. Prepare and upload the family files

On your computer, make a separate folder called `kindred-upload`, **outside the application/GitHub folder**. Keep a private backup of it. Arrange files like this:

| File on your computer | Exact destination name in Private Blob |
| --- | --- |
| `private-data/people.json` | `private-data/people.json` |
| `private-data/relationships.json` | `private-data/relationships.json` |
| `private-data/config.json` | `private-data/config.json` |
| `private-media/portraits/p0012.webp` | `private-media/portraits/p0012.webp` |

The folder names are part of the destination name. Uploading only `people.json` at the top level will not work. **Blob uses `config.json`, not `config.ts`.** Create that file with a plain-text editor:

```json
{
  "title": "Our family",
  "subtitle": "Our family archive",
  "isDemo": false,
  "featured": []
}
```

People and relationship files use the same format as option A. Photo entries also use the same relative names, such as `"file": "portraits/p0012.webp"`.

### 3. Upload through the Vercel website

Vercel supports uploads in its dashboard's file browser. You do not need Node.js, a terminal, or a local credentials file for this method. See Vercel's [dashboard upload documentation](https://vercel.com/docs/vercel-blob#dashboard-usage-counts-as-operations).

1. Open your project in Vercel, select **Storage**, and open the **Private** Blob store connected to it.
2. Open the store's file browser and use its file-upload control to select your files. Use destination/folder controls if available to keep the paths shown in the table above.
3. After uploading, inspect each file's full name/path. The required names are `private-data/people.json`, `private-data/relationships.json`, and `private-data/config.json`. Photos must keep their `private-media/` prefix and the relative name used in the person's record.
4. Open the family website and refresh it. For later updates, replace files at those same paths using the dashboard's replacement option if available.

The important check is the **full stored path**, not just the filename displayed in the list. A top-level `people.json` or a name with extra random characters will not work. Vercel's documentation confirms dashboard uploads, but does not describe every current path-selection control. If your upload screen cannot preserve the required paths or replace an existing file, use the fallback below.

### Optional: command-line uploads

This method explicitly sets each destination path and supports replacing existing files. Install Node.js **22** on your computer, open a terminal in `kindred-upload`, and run these commands one at a time. A terminal is the app where you type commands; on Windows you can use PowerShell, and on macOS use Terminal.

```sh
npx vercel login
npx vercel link
npx vercel env pull .env.local
```

Accept the Vercel command-line installation if prompted. Sign in with the account that owns the website. When linking, choose the existing website project, not a new project. The last command saves development settings privately on your computer. Do not upload `.env.local` to GitHub or Blob.

Then upload the three required files:

```sh
npx vercel blob put private-data/people.json --pathname private-data/people.json --access private --allow-overwrite
npx vercel blob put private-data/relationships.json --pathname private-data/relationships.json --access private --allow-overwrite
npx vercel blob put private-data/config.json --pathname private-data/config.json --access private --allow-overwrite
```

These commands replace any files already at those destination names. For each photograph, use the same pattern:

```sh
npx vercel blob put private-media/portraits/p0012.webp --pathname private-media/portraits/p0012.webp --access private --allow-overwrite
```

Replace the example photo name with your own file. Do not add a random filename suffix. Check the store's file list in Vercel afterward: all names must match the table exactly. Vercel's [upload-command guide](https://vercel.com/docs/cli/blob) explains the commands. A technical helper can also use the [README upload script](../README.md#vercel-private-blob) for many photographs.

**Later changes:** replace the objects at the same Blob names, then refresh the website. You do not need to change GitHub or redeploy for data/photo updates. Upload related record files together so person IDs stay consistent. You still need to redeploy after changing website settings or application code.

## C. Your own server

Choose this if you have someone comfortable managing a server. GitHub can hold a private copy of the application, but Vercel is not needed.

1. Copy the application to a private folder on the server. Put people/relationships in `private-data/`, edit `private-data/config.ts`, and put photos in `private-media/`, just as in option A.
2. Install Node.js **22**. Beside `package.json`, create a plain-text file named `.env.local` with your own values:

```dotenv
FAMILY_PASSWORD=your-shared-password
AUTH_SECRET=your-separate-random-secret
FAMILY_DATA_PROVIDER=local
```

3. In that application folder, run:

```sh
npm ci
npm run build
npm run start
```

4. Have the server administrator set up the web address, HTTPS (the browser's secure connection), and automatic restarting. Keep the private folders outside any direct file-sharing setup. Simply uploading the application to GitHub Pages or a static-file host will not run it.

Keep `.env.local` on the server, out of GitHub. For updates, replace the files in their existing locations, rebuild, and restart. The [README server section](../README.md#local-files-on-a-nodejs-server) has more detail.

To try the application only on your computer, use the same files/settings but run `npm run dev` after `npm ci`. Open `http://localhost:3000`. This is a local trial, not a public website.

## Check before sharing the website

Use a private/incognito browser window so you start logged out:

1. Opening the website should show the password page.
2. A wrong password should fail; the correct password should open the archive.
3. Check a few people, relationships, and photographs.
4. Log out, then open `/api/family-data` at your website address. It should show “Unauthorized,” not family records.
5. Opening `/private-data/people.json` should show a missing-page response, not records. Opening `/api/photos/example.jpg` while logged out should show “Unauthorized.”

If you suspect the password was shared improperly, change both `FAMILY_PASSWORD` and `AUTH_SECRET` in Vercel or on your server, then redeploy/restart every website using them. This signs everyone out. Previously downloaded information cannot be taken back.

## If something goes wrong

| What you see | What to check |
| --- | --- |
| Login never works | The correct password and `AUTH_SECRET` are saved for the live environment; redeploy after changing them |
| Login works, but the archive has an error | The selected storage option matches your setup; all required JSON files exist and follow the data guide |
| Blob archive cannot load | The store is Private, connected to the right project/environment, and has the three exact object names |
| A photograph shows initials | Check its filename, folder, format, and JSON `file` entry |
| Upload command says access is denied | Sign in to the right Vercel account and link the right project; check its Development store connection |
| Changes do not appear | Option A needs a completed deployment; option B needs replacement objects and a browser refresh |

For detailed file formats, use [DATA_SCHEMA.md](DATA_SCHEMA.md). For advanced setup and testing, use [README.md](../README.md).
