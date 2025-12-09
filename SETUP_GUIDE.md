# Complete Setup Guide - Step by Step

This guide will walk you through setting up your Razorpay Gateway from scratch. Don't worry if you're not technical - we'll go through everything step by step!

## Table of Contents
1. [What You Need Before Starting](#what-you-need-before-starting)
2. [Step 1: Set Up Supabase (Database)](#step-1-set-up-supabase-database)
3. [Step 2: Set Up Your Code on GitHub](#step-2-set-up-your-code-on-github)
4. [Step 3: Deploy to Vercel](#step-3-deploy-to-vercel)
5. [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
6. [Step 5: Set Up Your First Client, Price, and Route](#step-5-set-up-your-first-client-price-and-route)
7. [Step 6: Use the Checkout Snippet](#step-6-use-the-checkout-snippet)
8. [Step 7: Test Everything](#step-7-test-everything)
9. [Troubleshooting](#troubleshooting)

---

## What You Need Before Starting

Before we begin, make sure you have:

1. **A Supabase account** (free tier is fine) - we'll create this in Step 1
2. **A Vercel account** (free tier is fine) - we'll create this in Step 3
3. **A GitHub account** (free) - we'll use this in Step 2
4. **Razorpay account credentials** for at least one client (Key ID and Key Secret)
5. **About 30-45 minutes** to complete the setup

You don't need to install anything on your computer - we'll do everything through web browsers!

---

## Step 1: Set Up Supabase (Database)

Supabase is where we'll store all your client information, prices, and route mappings.

### 1.1 Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click the **"Start your project"** button (usually in the top right)
3. Click **"Sign in with GitHub"** (or use email if you prefer)
4. Authorize Supabase to access your GitHub account if prompted
5. You'll be taken to your Supabase dashboard

### 1.2 Create a New Project

1. In your Supabase dashboard, click the **"New Project"** button (green button, usually top right)
2. Fill in the project details:
   - **Name**: Give it a name like "Razorpay Gateway" or "Payment Gateway"
   - **Database Password**: Create a strong password (write it down somewhere safe - you'll need it later)
   - **Region**: Choose the region closest to you or your users
   - **Pricing Plan**: Select **"Free"** (this is fine for starting)
3. Click **"Create new project"**
4. Wait 2-3 minutes for Supabase to set up your project (you'll see a loading screen)

### 1.3 Run the SQL Schema

Once your project is ready:

1. In the left sidebar, click on **"SQL Editor"** (it has a database icon)
2. Click the **"New query"** button (top left, usually a "+" icon)
3. Open the file `schema.sql` from this project folder
4. Copy ALL the text from that file (you can select all with Ctrl+A or Cmd+A, then Ctrl+C or Cmd+C)
5. Paste it into the SQL Editor text box in Supabase
6. Click the **"Run"** button (or press Ctrl+Enter / Cmd+Enter)
7. You should see a success message saying something like "Success. No rows returned"

**What this did**: This created 3 tables in your database:
- `clients` - stores your client information
- `prices` - stores product/price information
- `funnel_routes` - maps URLs to clients and prices

### 1.4 Get Your Supabase API Keys

You'll need these keys in the next steps. Let's get them:

1. In the left sidebar, click on **"Settings"** (gear icon at the bottom)
2. Click on **"API"** in the settings menu
3. You'll see a page with several keys. You need these two:

   **a) Project URL:**
   - Look for **"Project URL"** section
   - Copy the URL (it looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **Save this somewhere** - you'll need it later

   **b) API Keys:**
   - Look for **"Project API keys"** section
   - Find the key labeled **"anon"** or **"public"** (it's the one that's visible by default)
   - Click the **eye icon** or **"Reveal"** button to see it
   - Copy this key (it's a long string starting with `eyJ...`)
   - **Save this somewhere** - this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   - Now find the key labeled **"service_role"** (it's usually below the anon key)
   - Click **"Reveal"** to see it
   - **⚠️ IMPORTANT**: This key is secret! Don't share it publicly.
   - Copy this key (also a long string)
   - **Save this somewhere** - this is your `SUPABASE_SERVICE_ROLE_KEY`

4. Keep this tab open - you'll need these values in Step 4

**Summary of what you should have saved:**
- Project URL (e.g., `https://xxxxx.supabase.co`)
- Anon/Public Key (long string starting with `eyJ...`)
- Service Role Key (long string starting with `eyJ...`)

---

## Step 2: Set Up Your Code on GitHub

We need to put your code on GitHub so Vercel can access it.

### 2.1 Create a GitHub Account (if you don't have one)

1. Go to [https://github.com](https://github.com)
2. Click **"Sign up"**
3. Follow the signup process
4. Verify your email if required

### 2.2 Create a New Repository

1. Once logged into GitHub, click the **"+"** icon in the top right
2. Click **"New repository"**
3. Fill in:
   - **Repository name**: `razorpay-gateway` (or any name you like)
   - **Description**: "Multi-tenant Razorpay payment gateway" (optional)
   - **Visibility**: Choose **"Private"** (recommended) or **"Public"**
   - **DO NOT** check "Initialize with README" (we already have files)
4. Click **"Create repository"**

### 2.3 Upload Your Code to GitHub

You have two options:

**Option A: Using GitHub Desktop (Easier for beginners)**

1. Download GitHub Desktop from [https://desktop.github.com](https://desktop.github.com)
2. Install and open it
3. Sign in with your GitHub account
4. Click **"File" → "Add Local Repository"**
5. Click **"Choose"** and navigate to your project folder (`RazorpayGHLGateway`)
6. Click **"Add Repository"**
7. In the bottom left, type a commit message like "Initial commit"
8. Click **"Commit to main"**
9. Click **"Publish repository"** (top right)
10. Make sure it's set to your GitHub account and the repository name matches
11. Click **"Publish Repository"**

**Option B: Using Git Command Line (if you're comfortable with terminal)**

1. Open terminal/command prompt in your project folder
2. Run these commands one by one:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
   (Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name)

Once done, you should see all your files on GitHub when you refresh the repository page.

---

## Step 3: Deploy to Vercel

Vercel will host your application and make it accessible on the internet.

### 3.1 Create a Vercel Account

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Sign Up"** (top right)
3. Click **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub account
5. You'll be taken to your Vercel dashboard

### 3.2 Import Your Project

1. In your Vercel dashboard, click the **"Add New..."** button (top right)
2. Click **"Project"**
3. You'll see a list of your GitHub repositories
4. Find your repository (the one you just created, e.g., `razorpay-gateway`)
5. Click **"Import"** next to it

### 3.3 Configure Project Settings

1. **Project Name**: Keep the default or change it (this will be part of your URL)
2. **Framework Preset**: Should auto-detect as "Next.js" - leave it as is
3. **Root Directory**: Leave as `./` (default)
4. **Build Command**: Leave as default (`npm run build`)
5. **Output Directory**: Leave as default (`.next`)
6. **Install Command**: Leave as default (`npm install`)

**⚠️ DO NOT click "Deploy" yet!** We need to add environment variables first.

---

## Step 4: Configure Environment Variables

This is where we connect Vercel to your Supabase database.

### 4.1 Add Environment Variables in Vercel

Before deploying, we need to add the environment variables. In the Vercel import screen:

1. Scroll down to the **"Environment Variables"** section
2. Click **"Add"** or the **"+"** button
3. Add each variable one by one:

   **Variable 1:**
   - **Name**: `SUPABASE_URL`
   - **Value**: Paste your Supabase Project URL (from Step 1.4)
   - Click **"Add"**

   **Variable 2:**
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Paste your Supabase Service Role Key (from Step 1.4)
   - Click **"Add"**

   **Variable 3:**
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Paste your Supabase Project URL again (same as Variable 1)
   - Click **"Add"**

   **Variable 4:**
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Paste your Supabase Anon/Public Key (from Step 1.4)
   - Click **"Add"**

   **Variable 5:**
   - **Name**: `ADMIN_PASSWORD`
   - **Value**: Choose a password for your admin panel (e.g., `MySecurePassword123!`)
   - **⚠️ Remember this password!** You'll need it to log into the admin panel.
   - Click **"Add"**

4. Make sure all 5 variables are listed
5. Now click the **"Deploy"** button (bottom right)

### 4.2 Wait for Deployment

1. Vercel will start building and deploying your project
2. This usually takes 2-5 minutes
3. You'll see a progress screen with logs
4. Wait until you see **"Ready"** or **"Deployment successful"**

### 4.3 Get Your Deployment URL

1. Once deployment is complete, you'll see a success message
2. Click **"Visit"** or look for a URL like: `https://your-project-name.vercel.app`
3. **Copy this URL** - this is your Vercel deployment URL
4. **Save it somewhere** - you'll need it in Step 6

**Congratulations!** Your application is now live on the internet! 🎉

---

## Step 5: Set Up Your First Client, Price, and Route

Now let's configure your first client in the admin panel.

### 5.1 Access the Admin Panel

1. Open your Vercel deployment URL in a new browser tab
2. You should see a welcome page
3. Click **"Go to Admin Panel"** or go directly to: `https://your-project.vercel.app/admin/login`
4. You'll see a login page

### 5.2 Log In

1. Enter the password you set in `ADMIN_PASSWORD` (from Step 4.1, Variable 5)
2. Click **"Login"**
3. You should now see the admin dashboard with three sections: Clients, Prices, and Funnel Routes

### 5.3 Add Your First Client

1. Click on **"Clients"** in the navigation (or you might already be on the Clients page)
2. Click the **"Add Client"** button (top right)
3. Fill in the form:
   - **ID**: A unique identifier (e.g., `client1` or `staragile` or `launchai`)
     - Use lowercase, no spaces (use underscores or hyphens if needed)
   - **Name**: The client's name (e.g., `Star Agile` or `Launch AI`)
   - **Razorpay Key ID**: Your client's Razorpay Key ID
     - This looks like: `rzp_test_xxxxxxxxxxxxx` (for test) or `rzp_live_xxxxxxxxxxxxx` (for live)
     - Get this from your Razorpay dashboard: Settings → API Keys
   - **Razorpay Key Secret**: Your client's Razorpay Key Secret
     - This is a long string - also from Razorpay dashboard
     - **⚠️ Keep this secret!**
4. Click **"Create Client"**
5. You should see the client appear in the table below

### 5.4 Add Your First Price

1. Click on **"Prices"** in the navigation
2. Click the **"Add Price"** button
3. Fill in the form:
   - **ID**: A unique identifier (e.g., `product1` or `devops_1999`)
   - **Client**: Select the client you just created from the dropdown
   - **Product Name**: The name of your product (e.g., `DevOps in 3 Days`)
   - **Amount (in paise)**: The price in paise
     - **Important**: ₹1 = 100 paise
     - Example: For ₹1,999, enter `199900`
     - Example: For ₹499, enter `49900`
   - **Currency**: Select `INR` (or USD/EUR if applicable)
   - **Thank You URL**: The full URL where users should be redirected after payment
     - Example: `https://yourdomain.com/thank-you`
     - Example: `https://yourdomain.com/success`
4. Click **"Create Price"**
5. You should see the price appear in the table

### 5.5 Add Your First Funnel Route

This connects a URL (domain + path) to a client and price.

1. Click on **"Funnel Routes"** in the navigation
2. Click the **"Add Route"** button
3. Fill in the form:
   - **Hostname**: The domain name (without `https://` or `www`)
     - Example: `launchwithai.in`
     - Example: `lp.staragile.com`
     - **Important**: Don't include `www.` - just the domain
   - **Path Prefix**: The path on that domain
     - Example: `/checkout`
     - Example: `/bootcamp/checkout`
     - **Important**: Must start with `/`
   - **Client**: Select your client from the dropdown
   - **Price**: Select your price from the dropdown
     - Note: Only prices for the selected client will show
   - **Active**: Make sure the checkbox is checked
4. Click **"Create Route"**
5. You should see the route appear in the table

**Example Route:**
- Hostname: `launchwithai.in`
- Path: `/checkout`
- This means: When someone visits `https://launchwithai.in/checkout`, it will use the selected client and price

---

## Step 6: Use the Checkout Snippet

Now let's get the code snippet to paste into your checkout pages.

### 6.1 Get the Checkout Snippet

1. In your project folder, open the file: `public/checkout-snippet.html`
2. Copy ALL the code from that file
3. Open a text editor (like Notepad, TextEdit, or VS Code)

### 6.2 Replace the Vercel URL

1. In the code you copied, find this line:
   ```javascript
   const API_BASE_URL = 'YOUR_VERCEL_URL';
   ```
2. Replace `YOUR_VERCEL_URL` with your actual Vercel URL (from Step 4.3)
   - Example: `const API_BASE_URL = 'https://your-project.vercel.app';`
   - **Important**: Don't include a trailing slash `/` at the end
3. Save the updated code

### 6.3 Paste into Your Checkout Page

**For GoHighLevel:**
1. Log into your GoHighLevel account
2. Go to your funnel/checkout page
3. Edit the page
4. Add a "Custom Code" or "HTML" block
5. Paste the entire snippet code
6. Save and publish

**For Other Landing Page Builders:**
1. Edit your checkout page
2. Look for an option to add "Custom HTML", "Code Block", or "Embed Code"
3. Paste the entire snippet
4. Save and publish

**For Custom HTML Pages:**
1. Open your checkout page HTML file
2. Paste the snippet code just before the closing `</body>` tag
3. Save the file

### 6.4 How the Snippet Works

The snippet will:
1. Read `name`, `email`, and `phone` from URL parameters (if present)
   - Example URL: `https://yourdomain.com/checkout?name=John&email=john@example.com&phone=9876543210`
2. Automatically detect the current page URL
3. Call your backend API to create a Razorpay order
4. Open the Razorpay payment popup
5. Redirect to the thank you page after successful payment

---

## Step 7: Test Everything

Let's make sure everything works!

### 7.1 Test the Admin Panel

1. Go to your admin panel: `https://your-project.vercel.app/admin/login`
2. Log in with your admin password
3. Verify you can see:
   - Your client in the Clients page
   - Your price in the Prices page
   - Your route in the Funnel Routes page

### 7.2 Test the Checkout Flow

1. Go to your checkout page (the one where you pasted the snippet)
2. Add URL parameters to test:
   - Example: `https://yourdomain.com/checkout?name=Test%20User&email=test@example.com&phone=9876543210`
3. The page should automatically:
   - Show the Razorpay payment popup
   - Display the correct product name
   - Show the correct amount
4. **For testing**: Use Razorpay test mode
   - Use test credentials from Razorpay dashboard
   - Use test card: `4111 1111 1111 1111`
   - Any future expiry date
   - Any CVV
5. Complete the payment
6. You should be redirected to your thank you page

### 7.3 Verify the Route Mapping

Make sure your route is set up correctly:
- Hostname matches exactly (no `www`, no `https://`)
- Path matches exactly (case-sensitive, must start with `/`)
- Route is marked as "Active" in the admin panel

---

## Troubleshooting

### Problem: Can't log into admin panel

**Solution:**
- Make sure you're using the password you set in `ADMIN_PASSWORD` environment variable
- Check that the environment variable is set correctly in Vercel
- Try clearing your browser cookies and logging in again

### Problem: Admin panel shows "Error loading clients/prices/routes"

**Solution:**
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel
- Verify the values are correct (no extra spaces)
- Check your Supabase project is still active
- Look at the browser console (F12) for error messages

### Problem: "Route not found" error when testing checkout

**Solution:**
- Check that you created a funnel route in the admin panel
- Verify the hostname matches exactly (no `www`, no protocol)
- Verify the path matches exactly (case-sensitive)
- Make sure the route is marked as "Active"
- Example: If your URL is `https://www.example.com/checkout`, your route should be:
  - Hostname: `example.com` (not `www.example.com`)
  - Path: `/checkout`

### Problem: Razorpay payment popup doesn't open

**Solution:**
- Check that you replaced `YOUR_VERCEL_URL` in the checkout snippet
- Verify your Vercel deployment is live (visit the URL in browser)
- Check browser console (F12) for JavaScript errors
- Make sure Razorpay Checkout.js script is loading (check Network tab in browser dev tools)

### Problem: "Order creation failed" error

**Solution:**
- Check that the client's Razorpay credentials are correct
- Verify the Razorpay account is active
- Check that the amount is in paise (not rupees)
- Look at Vercel function logs for more details:
  1. Go to Vercel dashboard
  2. Click on your project
  3. Click "Functions" tab
  4. Click on the failed function to see logs

### Problem: Payment succeeds but doesn't redirect

**Solution:**
- Check that the `thank_you_url` in your price is a full URL (starts with `https://`)
- Verify the thank you URL is accessible
- Check browser console for errors

### Problem: Can't see my Supabase tables

**Solution:**
- Go back to Supabase SQL Editor
- Run the schema.sql again
- Check the "Table Editor" in Supabase to verify tables exist

### Problem: Environment variables not working

**Solution:**
- In Vercel, go to your project → Settings → Environment Variables
- Verify all 5 variables are there
- Make sure there are no extra spaces before/after the values
- After adding/changing variables, you need to redeploy:
  1. Go to Deployments tab
  2. Click the three dots (...) on the latest deployment
  3. Click "Redeploy"

### Getting More Help

If you're still stuck:
1. Check the browser console (F12 → Console tab) for errors
2. Check Vercel function logs (Dashboard → Project → Functions)
3. Check Supabase logs (Dashboard → Logs)
4. Verify all environment variables are set correctly
5. Make sure all URLs are correct (no typos, proper https://)

---

## What's Next?

Once everything is working:

1. **Add more clients**: Repeat Step 5.3 for each client
2. **Add more prices**: Repeat Step 5.4 for each product
3. **Add more routes**: Repeat Step 5.5 for each checkout page
4. **Switch to live mode**: When ready, update Razorpay credentials to live keys
5. **Customize**: You can modify the admin UI styling if needed
6. **Add security**: Consider adding Row Level Security (RLS) in Supabase for production

---

## Quick Reference: Environment Variables

Here's a quick checklist of all environment variables you need in Vercel:

- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (secret!)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Same as SUPABASE_URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- [ ] `ADMIN_PASSWORD` - Your admin panel password

---

## Quick Reference: What Goes Where

**Supabase stores:**
- Client information (Razorpay keys)
- Product/price information
- URL-to-client/price mappings

**Vercel hosts:**
- Your admin panel (web interface)
- Your API endpoint (`/api/create-order`)

**Your checkout pages:**
- The snippet code that calls your API and opens Razorpay

---

**Congratulations!** You've set up a complete multi-tenant Razorpay payment gateway! 🎉

If you have any questions or run into issues, refer back to the Troubleshooting section above.

