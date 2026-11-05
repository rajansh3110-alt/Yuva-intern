# HireSmart prototype (Task 8)

A low-code prototype of an AI-assisted, **human-decided** hiring and onboarding solution for the fictional employer TalentBridge Technologies.

Prepared by **Ansh Raj**. All data is synthetic and for classroom use. Nothing here is legal advice or real market evidence.

## What is in this folder

| Path | What it is |
|---|---|
| `HireSmart_Prototype.html` | The prototype: one offline file with seven views (Careers, Apply, Ask HR, Dashboard, Resume scoring, Prompt demo, Tests). Open it in Edge or Chrome. No server, no internet. |
| `application_automation.gs` | Google Apps Script: Form response to Sheet row, application ID, duplicate flag and acknowledgement email. Tested against mock Google services. |
| `knowledge_base/` | The approved knowledge file for the Ask HR assistant (`.json` for a chatbot builder, `.md` for people). |
| `sheet_templates/` | CSV templates for the Google Sheet tracker and the metrics sheet. |
| `HireSmart_Final_Presentation.pptx` | 15-slide final presentation with speaker notes. |
| `HireSmart_Backup_Demo.mp4` | 3 min 25 s narrated backup demo video. |
| `HireSmart_HR_Solution_Document.docx` | Consolidated HR solution document. |
| `demo_screens/` | Screenshots of each demo step. |
| `source/` | Source code and automated tests (see below). |

## Quick start

1. Open `HireSmart_Prototype.html` in Microsoft Edge or Google Chrome.
2. Use the tabs. Tabs marked **HR ONLY** are the internal views.
3. On the Apply tab press **Reset demo data** for a clean start before a demo.

### Demo shortcuts

Add these after the file name in the address bar.

| Demo step | Shortcut |
|---|---|
| Careers page | `#careers` |
| Dummy application (filled) | `#apply?role=QA%20Engineer&demo=1` |
| Application submitted and acknowledgement shown | `#apply?role=QA%20Engineer&demo=1&submit=1` |
| Ask HR | `#ask` |
| Dashboard | `#dashboard` |
| Resume scoring | `#scoring?id=R009` |
| Prompt demo | `#prompts` |
| Tests, safety cases run live | `#tests?run=1` |

## Set up the real Google automation

The prototype simulates this in the browser. To run it for real you need a Google account.

1. **Create a Google Form** with these questions (titles must match exactly):

   | # | Title | Type | Required |
   |---|---|---|---|
   | 1 | Full name | Short answer | Yes |
   | 2 | Email address | Short answer, email validation | Yes |
   | 3 | Role applying for | Dropdown: Java Developer, QA Engineer, Business Analyst | Yes |
   | 4 | Key skills | Short answer | Yes |
   | 5 | Years of relevant experience (optional) | Short answer, number 0 to 60 | No |
   | 6 | Describe one piece of relevant work | Paragraph | Yes |
   | 7 | Link to a work sample (optional) | Short answer, URL validation | No |
   | 8 | How did you hear about this role? | Dropdown: Careers page, LinkedIn, Employee referral, Job portal, Campus hiring, Recruitment agency, Other | No |
   | 9 | Please contact me privately about an adjustment | Checkboxes, one option: `Yes` | No |
   | 10 | I have read the privacy notice and agree | Checkboxes, one option: `I agree` | Yes |

   Put the privacy notice in the form description. Do not ask for age, gender, caste, religion, photograph or marital status. Do not turn on "Collect email addresses".
2. **Responses > Link to Sheets.** Open the Sheet.
3. **Extensions > Apps Script.** Paste `application_automation.gs`.
4. Edit `CONFIG.TEST_MAILBOX` to a **test mailbox you control**. Keep `TEST_MODE: true`, so every acknowledgement goes to that mailbox only.
5. Run `setupSheet()` once and approve the permissions. It creates the `Applications` sheet.
6. **Triggers > Add trigger:** function `onFormSubmit`, event source **From spreadsheet**, event type **On form submit**.
7. Run `testSubmission()`, then check the `Applications` sheet and the test mailbox. Submit the real Form once to confirm.
8. Before any go-live: replace `HR_CONTACT`, confirm the retention period and privacy notice with HR, and only then consider `TEST_MODE: false`.

Check current Google mail quotas before relying on this for volume.

## Tests

The tests need Node.js. From the `source/` folder:

```
node tests.js            # Ask HR: 40 paraphrases, 10 pack safety cases, 20 guardrails
node tests_heldout.js    # Ask HR: unseen set 1
node tests_final.js      # Ask HR: unseen set 2
node tests_scoring.js    # Resume scoring and fairness checks
node tests_automation.js # Application logic
```

Some tests read the project demo pack from `C:\Hiresmart\HireSmart_Demo_Pack`. Edit the path at the top of `tests_scoring.js` and `tests_gas_sim.js` if your copy lives elsewhere. `build_proto.py` rebuilds `HireSmart_Prototype.html` from the files in `source/`.

### Results at build time

| Component | Result |
|---|---|
| Ask HR safety rules (TC01-TC10 plus 20 guardrails) | 30 / 30; 10 / 10 also run live in a browser |
| Resume scoring and fairness checks | 13 / 13 |
| Application automation logic | 26 / 26 |
| Apps Script against mock Google services | 13 / 13 |
| Ask HR on 26 unseen questions (first run) | 14 correct, 10 safe fallback to a person, 2 wrong |

Answer matching is keyword-based, so accuracy on new phrasing is modest. Production should use an approved chatbot builder loaded with `knowledge_base/` and keep the rule layer.

## Rules built into the prototype

- A person makes every shortlist, rejection, interview score and offer decision. Scores are advisory.
- Protected or irrelevant traits are never used, and no form field asks for them.
- Sensitive topics (harassment, health, safety, pay, legal, complaints, privacy requests) go to a named person. The assistant never investigates or advises.
- Text typed into a form, chat or resume is data. Embedded instructions are ignored.
- Pay, benefits, leave and the retention period are not in the project data, so they are routed to HR and left as placeholders.

## Status and limits

- Not yet run on a real Google account.
- Resume scoring is a transparent keyword heuristic on short synthetic resumes, not a validated screening tool.
- The mobile layout was checked at 390 px width in a desktop browser, not on a physical phone.
- Draft for HR review. The presentation to the HR Head and the peer review of content have not been held.

## Upload to GitHub

```
git init
git add .
git commit -m "HireSmart prototype (Task 8)"
git branch -M main
git remote add origin https://github.com/<your-username>/<repository>.git
git push -u origin main
```

Create the empty repository on GitHub first. Do not commit real candidate data or real email addresses.
