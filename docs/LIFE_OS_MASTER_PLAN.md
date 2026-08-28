# LIFE OS — MASTER PRODUCT PLAN

## 0. Regula supremă

Produsul NU este:
- un task manager;
- un calendar;
- un project manager;
- un habit tracker;
- o aplicație financiară;
- un notes app.

Este un **Life Operating System**.

Toate acestea sunt module ale aceluiași sistem.

Direcția nu se schimbă când apare o funcție nouă. Orice funcție trebuie să răspundă la una dintre întrebările:

**Ce vreau să obțin?** → Goals  
**Ce proiecte mă duc acolo?** → Projects  
**Ce trebuie să fac?** → Tasks  
**Când fac?** → Calendar  
**Ce repet?** → Habits / Routines  
**Ce trebuie să țin minte?** → Notes / Knowledge  
**Cu cine are legătură?** → People  
**Ce resurse implică?** → Finance / Files / Assets  
**Ce necesită atenție acum?** → Today / Inbox / Reviews  
**Ce poate face sistemul singur?** → Automations

Aceasta este arhitectura permanentă.

---

# 1. Structura fundamentală

## Life Areas

Nivelul cel mai înalt.

Exemple:

- Personal
- Family
- Work
- Business
- Health
- Finance
- Home
- Learning
- Fitness
- Travel
- Social
- Creative
- Admin

Userul poate crea orice Area.

Fiecare Area are:

- nume;
- icon;
- culoare;
- descriere;
- status;
- priority;
- goals;
- projects;
- notes;
- files;
- people;
- calendar filtering;
- statistics.

---

# 2. Goals

Obiective pe termen lung sau mediu.

Tipuri:

- lifetime;
- yearly;
- quarterly;
- monthly;
- custom.

Goal fields:

- title;
- description;
- Area;
- start date;
- target date;
- status;
- priority;
- progress;
- metric;
- target value;
- current value;
- unit;
- milestones;
- linked projects;
- linked habits;
- linked tasks;
- notes;
- files.

Progress poate fi:

- manual;
- calculat din projects;
- calculat din milestones;
- numeric;
- percentage;
- habit based.

Exemplu:

Goal:
`Save £20,000`

Progress:
`£7,450 / £20,000`

---

# 3. Projects

Un Project este ceva finit care trebuie dus de la început la sfârșit.

Project fields:

- title;
- description;
- Area;
- Goal;
- status;
- project health;
- priority;
- owner;
- team;
- start date;
- target date;
- actual completion date;
- progress;
- budget;
- estimated effort;
- actual effort;
- tags;
- files;
- notes;
- links;
- milestones;
- tasks;
- dependencies;
- activity log.

Statuses default:

- Idea
- Planned
- Active
- On Hold
- Blocked
- Completed
- Cancelled
- Archived

Health:

- Green
- Amber
- Red

## Project views

Fiecare proiect trebuie să poată fi văzut ca:

- Overview
- List
- Board
- Timeline
- Gantt
- Calendar
- Milestones
- Files
- Notes
- Activity
- Analytics

Aceleași date.

Nu copii diferite ale taskurilor.

---

# 4. Milestones

Milestone ≠ task.

Este un punct important într-un proiect.

Fields:

- title;
- target date;
- status;
- dependencies;
- linked tasks;
- description;
- owner.

Exemple:

`Website ready`

`First paying customer`

`App submitted`

---

# 5. Tasks

Taskul devine obiect central al sistemului.

Fields:

- title;
- description;
- Area;
- Project;
- Parent task;
- subtasks;
- assignee;
- status;
- priority;
- start;
- deadline;
- scheduled time;
- estimated duration;
- actual duration;
- tags;
- calendar;
- reminders;
- recurrence;
- dependencies;
- attachments;
- comments;
- notes;
- checklist;
- location;
- energy level;
- context;
- created date;
- completed date;
- activity history.

## Task hierarchy

Nelimitată:

Task  
→ Subtask  
→ Subtask  
→ Subtask  
→ orice adâncime.

Regula actuală de progress rămâne:

leaf tasks determină progresul.

Parent completion poate fi automat.

---

# 6. Task statuses

Nu doar:

`Done / Not Done`

Ci:

- Inbox
- Planned
- To Do
- In Progress
- Waiting
- Blocked
- Review
- Done
- Cancelled

Pot exista statusuri custom.

---

# 7. Dependencies

Taskurile pot avea:

- blocked by;
- blocking;
- must start after;
- must finish before;
- linked but independent.

Exemplu:

`Deploy website`

este blocat de:

`Finish payment integration`.

Dependencies apar în Timeline/Gantt.

---

# 8. Recurring Tasks

Repeat:

- daily;
- weekdays;
- weekly;
- specific weekdays;
- monthly;
- yearly;
- custom interval;
- after completion.

Exemple:

`Pay rent — every month`

`Change water filter — every 90 days`

`Call mum — every Sunday`

Important:

Recurring task creează instanțe, nu rescrie trecutul.

---

# 9. Inbox / Quick Capture

Una dintre cele mai importante funcții.

Userul trebuie să poată scrie în câteva secunde:

`Sun dentist`

și atât.

Fără:

- project;
- date;
- priority;
- group.

Intră în Inbox.

Mai târziu poate deveni:

- task;
- note;
- event;
- project;
- reminder;
- expense;
- contact follow-up.

---

# 10. My Tasks

Rămâne.

Dar devine transversal peste întreg sistemul.

Sections:

- Inbox
- Overdue
- Today
- Tomorrow
- This Week
- Next Week
- Later
- Waiting
- Blocked
- Someday
- Completed

Filters:

- Area;
- Project;
- tag;
- priority;
- status;
- calendar;
- assignee.

---

# 11. Today

Devine home screen principal.

Arată doar ce contează acum.

## Morning

- appointments;
- scheduled tasks;
- habits;
- deadlines;
- bills;
- reminders.

## Attention

- overdue;
- blocked;
- project risks;
- missed habits;
- upcoming deadlines.

## Today timeline

Calendarul zilei.

## Quick capture

Permanent vizibil.

## End of day

- completed;
- postponed;
- missed;
- tomorrow preview.

---

# 12. Calendar

Calendarul actual NU dispare.

Devine și mai central.

Views:

- Day
- Week
- Month
- Agenda
- Timeline

Calendarul poate afișa:

- Events
- Tasks
- Habits
- Milestones
- Bills
- Birthdays
- Reminders
- Deadlines
- Goals
- Travel
- Appointments

Filters după:

- Area;
- project;
- calendar;
- item type;
- tag.

---

# 13. Multiple Calendars

Rămân.

Exemple:

- Personal
- Work
- Family
- Achu
- Gym
- Finance

Fiecare:

- name;
- colour;
- visible/hidden;
- default reminders.

Posibil mai târziu:

- Google Calendar sync;
- Outlook Calendar sync;
- Apple Calendar integration prin standardele disponibile.

---

# 14. Events

Events rămân obiect separat de Tasks.

Event fields:

- title;
- date;
- start/end;
- location;
- calendar;
- description;
- participants;
- reminders;
- recurrence;
- files;
- notes;
- linked project;
- linked Area.

---

# 15. Habits

Un modul complet.

Habit:

- name;
- Area;
- frequency;
- target;
- unit;
- schedule;
- reminders;
- streak;
- history;
- goal;
- notes.

Examples:

`Gym — 4x/week`

`Read — 30 min/day`

`Walk — 8,000 steps`

## Habit metrics

- current streak;
- longest streak;
- weekly completion;
- monthly completion;
- consistency.

---

# 16. Routines

Habit ≠ Routine.

Routine = grup de acțiuni.

Exemplu:

Morning Routine:

1. Water
2. Shower
3. Breakfast
4. Plan Today
5. Gym

Poate genera taskuri automat.

---

# 17. Notes / Knowledge

Un modul complet pentru informație.

Types:

- quick note;
- project note;
- meeting note;
- journal entry;
- reference;
- idea;
- checklist;
- document note.

Features:

- rich text;
- markdown;
- headings;
- links;
- attachments;
- tags;
- backlinks;
- mentions;
- search.

Notes pot fi legate de:

- task;
- project;
- goal;
- Area;
- person;
- event.

---

# 18. People

Mini personal CRM.

Person:

- name;
- photo;
- phone;
- email;
- relationship;
- company;
- birthday;
- notes;
- tags;
- last contact;
- next follow-up;
- linked projects;
- events;
- tasks;
- documents.

Useful views:

- birthdays;
- follow-ups;
- recently contacted;
- no contact for X days.

---

# 19. Finance

Nu contabilitate bancară completă.

Life finance organiser.

## Transactions

- income;
- expense;
- transfer.

## Bills

- recurring bills;
- due dates;
- payment reminders;
- status.

## Subscriptions

- service;
- price;
- interval;
- renewal;
- cancellation deadline.

## Budgets

By:

- month;
- category;
- Area;
- project.

## Goals

- emergency fund;
- holiday;
- car;
- house;
- investments.

## Finance dashboard

- income;
- spending;
- bills due;
- subscriptions;
- savings progress.

---

# 20. Assets

Lucrurile importante pe care le deții.

Examples:

- car;
- laptop;
- phone;
- appliances;
- equipment.

Asset:

- purchase date;
- purchase price;
- warranty;
- documents;
- serial;
- maintenance;
- recurring maintenance tasks.

---

# 21. Documents / Files

Central file library.

Categories:

- personal;
- finance;
- contracts;
- receipts;
- project files;
- insurance;
- property;
- vehicle;
- certificates.

Files pot fi atașate oricărui obiect.

---

# 22. Home management

Optional module.

- maintenance;
- appliances;
- warranties;
- recurring chores;
- utility readings;
- household inventory;
- property documents.

---

# 23. Travel

Trip object:

- destination;
- dates;
- itinerary;
- bookings;
- accommodation;
- flights;
- tasks;
- budget;
- documents;
- packing list;
- notes.

Totul apare automat în Calendar.

---

# 24. Health & Fitness organiser

Fără diagnostic medical.

Poate gestiona:

- workouts;
- appointments;
- measurements;
- goals;
- routines;
- supplements/medication reminders;
- documents;
- progress.

Nu trebuie să pretindă că oferă diagnostic medical.

---

# 25. Learning

Courses:

- course;
- lessons;
- progress;
- notes;
- study sessions;
- deadlines;
- certificates.

Learning goals pot fi conectate la Projects.

---

# 26. Journal

Daily journal:

- text;
- mood;
- day rating;
- highlights;
- problems;
- gratitude;
- attachments.

Poate exista calendar/journal history.

---

# 27. Tags

Cross-system.

Exemple:

`urgent`

`phone`

`waiting`

`outside`

`5-minute`

`computer`

`deep-work`

Aceeași etichetă poate exista pe:

tasks, notes, projects, people etc.

---

# 28. Contexts

Separate de tags dacă vrem GTD-style.

Examples:

- @home
- @computer
- @phone
- @outside
- @car

---

# 29. Energy

Optional pentru task.

- low;
- medium;
- high.

Poți întreba:

`Ce pot face acum în 20 de minute cu energie mică?`

---

# 30. Time estimates

Task:

`Estimate: 40 min`

Actual:

`52 min`

Permite analytics.

---

# 31. Time tracking

Timer:

Start → Pause → Finish.

History per:

- task;
- project;
- Area;
- day;
- week.

---

# 32. Focus Mode

Un singur task.

Afișează:

- task;
- notes;
- timer;
- subtasks;
- files.

Restul UI dispare.

Optional:

Pomodoro.

---

# 33. Search global

Obligatoriu.

Caută în:

- tasks;
- projects;
- goals;
- events;
- notes;
- people;
- files;
- habits;
- finance.

Search filters.

---

# 34. Command Palette

Desktop:

`Ctrl/Cmd + K`

Exemple:

`Create task`

`Open project AWAKE`

`Go to calendar`

`Search Roberto`

---

# 35. Notifications

Types:

- local;
- push;
- in-app.

Reminder options:

- at time;
- 5 min;
- 15 min;
- 30 min;
- 1h;
- 1 day;
- custom.

Multiple reminders per object.

---

# 36. Notification Centre

Istoric:

- unread;
- read;
- dismissed.

Notifications importante nu dispar accidental.

---

# 37. Automations

Un engine comun.

Format:

**WHEN**
condition

**IF**
optional filters

**THEN**
action.

Examples:

WHEN task completed  
THEN unblock next task.

WHEN project becomes Red  
THEN create review task.

WHEN bill is paid  
THEN schedule next bill.

WHEN new task enters project  
THEN assign tag.

WHEN milestone is 3 days away  
THEN push reminder.

---

# 38. Rules engine

Triggers:

- date;
- status;
- completion;
- creation;
- modification;
- recurrence;
- deadline approaching;
- value threshold.

Actions:

- create;
- update;
- assign;
- move;
- notify;
- archive;
- duplicate;
- link.

---

# 39. Templates

Templates pentru:

- projects;
- tasks;
- routines;
- trips;
- checklists;
- notes;
- weekly reviews.

Exemplu:

`Launch Website`

poate genera automat 40 taskuri.

---

# 40. Weekly Review

Workflow ghidat.

Step 1:
Process Inbox.

Step 2:
Review overdue.

Step 3:
Review active projects.

Step 4:
Projects fără next action.

Step 5:
Goals progress.

Step 6:
Calendar previous week.

Step 7:
Calendar next week.

Step 8:
Finance upcoming.

Step 9:
Habits.

Step 10:
Set priorities.

---

# 41. Monthly Review

- goals;
- finances;
- habits;
- projects;
- time distribution;
- wins;
- failures;
- next month.

---

# 42. Dashboard

Customizable widgets.

Examples:

- Today;
- Calendar;
- Goals;
- Active Projects;
- Overdue;
- Habits;
- Finance;
- Time;
- Inbox;
- Upcoming;
- Birthdays.

Userul poate muta widgets.

---

# 43. Analytics

Personal analytics:

- task completion;
- overdue rate;
- planned vs completed;
- time by Area;
- time by project;
- goal progress;
- habits consistency;
- project velocity;
- project delays;
- calendar load;
- spending.

---

# 44. Project analytics

- completion %;
- planned vs actual;
- overdue tasks;
- blocked tasks;
- milestone status;
- workload;
- time spent;
- budget.

---

# 45. Timeline / Gantt

Project Timeline.

Features:

- drag dates;
- dependencies;
- milestones;
- groups;
- critical path later;
- zoom day/week/month/quarter.

---

# 46. Kanban

Columns by:

- status;
- priority;
- custom field.

Drag & drop.

---

# 47. Custom Views

User saves query:

`High priority + Work + this week`

ca view permanent.

---

# 48. Custom Fields

Field types:

- text;
- number;
- currency;
- percentage;
- date;
- dropdown;
- multi-select;
- checkbox;
- person;
- link;
- formula.

---

# 49. Formulas

Later.

Example:

`Remaining Budget = Budget - Expenses`

---

# 50. Relationships

Orice obiect poate avea links.

Example:

Task → Project  
Project → Goal  
Goal → Area  
Project → Person  
Task → File  
Event → Person  
Expense → Project

Asta este una dintre componentele centrale ale Life OS.

---

# 51. Activity History

Fiecare obiect are timeline:

- created;
- edited;
- status changed;
- comments;
- files;
- completion.

---

# 52. Version History

Pentru notes/projects importante.

Restore previous version.

---

# 53. Archive

Orice poate fi archived.

Archive ≠ delete.

---

# 54. Trash

Soft delete.

Restore timp de X zile.

---

# 55. Cloud sync

Local-first trebuie păstrat cât posibil.

Model:

device local data  
→ cloud sync  
→ other devices.

Offline trebuie să funcționeze pentru funcțiile principale.

---

# 56. Conflict handling

Dacă două device-uri modifică același lucru:

- detect conflict;
- safe merge unde posibil;
- user resolution unde nu este posibil.

---

# 57. Backup

Automatic backups.

Manual export.

Restore.

---

# 58. Export

Formats:

- JSON;
- CSV;
- Markdown;
- calendar ICS;
- PDF pentru reports.

---

# 59. Import

Potential:

- CSV;
- JSON;
- Todoist;
- Asana;
- Trello;
- calendar ICS.

---

# 60. Account

Future dacă aplicația devine multi-user/cloud complet.

- login;
- devices;
- sessions;
- security;
- backup.

---

# 61. Multi-user

Nu este obligatoriu pentru Life OS personal, dar arhitectura nu trebuie să-l blocheze.

Possible later:

- shared projects;
- shared family calendar;
- task assignments;
- comments;
- shared shopping lists.

---

# 62. Family Mode

Shared:

- calendar;
- chores;
- shopping;
- bills;
- trips;
- documents.

Private Areas rămân private.

---

# 63. Permissions

Dacă apare sharing:

- Owner
- Editor
- Contributor
- Viewer

---

# 64. Integrations

Future integration layer.

Potential:

- Google Calendar;
- Outlook Calendar;
- Gmail;
- Google Drive;
- Dropbox;
- GitHub;
- Slack;
- weather;
- maps;
- email forwarding.

Dar niciun integration provider nu devine parte fundamentală a modelului.

Dacă Google dispare, Tasks trebuie să funcționeze în continuare.

---

# 65. Email-to-task

Forward email → Inbox.

---

# 66. Share-to-Life-OS

Mobile share sheet:

URL / text / image  
→ Inbox.

---

# 67. Browser extension

Save:

- article;
- URL;
- note;
- task.

---

# 68. Location

Optional.

Task:

`Buy milk`

location:

`Tesco`

Poate declanșa reminder când ajungi în zonă dacă OS-ul permite.

---

# 69. Maps

Travel/tasks/events pot afișa locația.

Nu devine map app.

---

# 70. Weather

Calendar poate afișa vremea relevantă pentru zi.

Optional integration.

---

# 71. AI layer

AI este **asistent**, nu fundația aplicației.

Life OS trebuie să funcționeze complet fără AI.

AI poate:

- rezuma notes;
- propune subtasks;
- identifica taskuri din text;
- organiza Inbox;
- genera project template;
- sugera calendar scheduling;
- găsi conflicte;
- rezuma weekly review;
- search semantic;
- compara plan vs progress.

AI nu modifică masiv date fără confirmare.

---

# 72. Natural language capture

Example:

`Dentist next Tuesday at 3 remind me 2 hours before`

Sistemul interpretează:

Event:
Dentist

Date:
Tuesday

Time:
15:00

Reminder:
2h

Confirm → save.

---

# 73. AI Planning

User:

`Vreau să mă mut în altă casă în 4 luni`

AI poate propune:

Goal → Project → Milestones → Tasks.

Dar userul aprobă structura.

---

# 74. AI Daily Brief

Potential:

`Ai 3 întâlniri, 7 taskuri și un deadline la 17:00.`

---

# 75. AI Weekly Review

Poate rezuma datele existente.

Nu inventează progres.

---

# 76. AI Search

Example:

`Unde am notat dimensiunea frigiderului?`

Search semantic peste datele userului.

---

# 77. Voice Capture

Optional.

Speech → Inbox.

---

# 78. Widgets

Mobile:

- Today;
- Quick Add;
- Habits;
- Next Event.

---

# 79. Watch integration

Possible later:

- view next task;
- complete task;
- habit check;
- reminder.

---

# 80. Mobile offline

Core:

Tasks, Today, Calendar, Notes trebuie să funcționeze fără internet.

---

# 81. Desktop

Desktop poate avea:

- full sidebar;
- split views;
- keyboard shortcuts;
- command palette;
- drag/drop.

---

# 82. Navigation

## Mobile bottom navigation

**Today | Tasks | Calendar | Projects | More**

Nu 15 taburi.

## More

- Goals
- Habits
- Notes
- People
- Finance
- Files
- Reviews
- Settings

## Desktop

Sidebar complet.

---

# 83. Universal Create Button

Un `+`.

Apoi:

- Task
- Event
- Project
- Note
- Habit
- Goal
- Expense
- Person

---

# 84. Home / Today philosophy

Userul nu trebuie să decidă în fiecare dimineață unde să intre.

Life OS trebuie să-i arate automat ce necesită atenție.

---

# 85. Design philosophy

Complexitate mare în motor.

Interfață simplă.

Nu arătăm toate câmpurile peste tot.

Basic mode:

title/date/project.

Advanced:

dependencies/custom fields/etc.

---

# 86. Core data model

Nu mai avem logică separată în:

Tasks.tsx  
MyTasks.tsx  
Calendar.tsx.

Trebuie un singur core.

Conceptual:

User  
→ Areas  
→ Goals  
→ Projects  
→ Tasks

Plus objects:

Events  
Habits  
Notes  
People  
Finance  
Files.

Views citesc același store.

---

# 87. Core services

Separat de UI:

Task Engine  
Project Engine  
Calendar Engine  
Recurrence Engine  
Reminder Engine  
Automation Engine  
Sync Engine  
Search Engine  
File Engine  
Analytics Engine.

UI nu implementează business logic.

---

# 88. Extensibility

Orice modul nou trebuie să respecte:

- common IDs;
- common timestamps;
- relationships;
- tags;
- archive;
- search;
- activity log.

---

# 89. Ce NU trebuie făcut

Nu construim câte o aplicație în aplicație.

Nu:

`Tasks database`

plus

`Calendar database`

plus

`Projects database`

care duplică același task.

Un task este un singur obiect.

Calendar îl vede.

Project îl vede.

Today îl vede.

My Tasks îl vede.

Analytics îl vede.

---

# 90. Funcții „nebune”, dar posibile în viitor

Acestea sunt compatibile cu direcția, dar foarte târziu:

- automatic scheduling;
- capacity optimisation;
- life timeline pe ani;
- relationship graph;
- personal knowledge graph;
- predictive deadline risks;
- smart rescheduling;
- automatic travel planning;
- receipt parsing;
- OCR document filing;
- email triage;
- financial forecasting;
- smart goal decomposition;
- energy-based scheduling;
- context-aware suggestions;
- voice assistant;
- daily generated briefing;
- project risk prediction;
- calendar optimisation;
- life analytics over years.

Ele NU schimbă direcția.

Sunt extensii peste aceleași obiecte.

---

# 91. Ce este imposibil sau nu trebuie promis

Life OS nu poate garanta:

- că poate controla orice aplicație externă;
- background execution nelimitat pe iPhone;
- acces la date pe care OS-ul nu permite aplicației să le vadă;
- universal sync cu orice serviciu;
- realtime location fără permisiuni;
- AI 100% corect;
- predicții perfecte;
- automatic decisions fără risc;
- conflicte cloud imposibile în orice condiție;
- recuperarea datelor care nu au fost niciodată salvate/backed up.

Nu devine:

- bancă;
- contabil autorizat;
- doctor;
- avocat;
- password manager;
- cloud storage general;
- social network.

Poate organiza informațiile din acele domenii.

---

# 92. Regula anti-scope-creep

Înainte de orice funcție nouă se întreabă:

**Este un nou obiect fundamental?**

Dacă nu:

**În ce obiect existent intră?**

Example:

Packing list → Trip/Project checklist.

Nu facem modul separat `Packing App`.

Vehicle MOT → Asset + Event + Reminder.

Nu facem `Car App`.

Birthday → Person + Event.

Nu facem `Birthday Manager`.

Asta împiedică produsul să se schimbe la fiecare idee.

---

# 93. Ordinea reală de construcție

## FOUNDATION

1. Common data model
2. Central store
3. Unified persistence
4. IDs/relationships
5. archive/trash
6. search foundation
7. migration from current localStorage model

Actualele Tasks/MyTasks/Calendar trebuie să continue să funcționeze.

---

# 94. PHASE 1 — Core Life Organisation

- Areas
- Projects
- improved Tasks
- statuses
- tags
- Inbox
- Search
- recurring tasks
- advanced reminders
- Today
- archive.

La sfârșitul Phase 1:
aplicația este deja un Life Organiser real.

---

# 95. PHASE 2 — Project Management

- milestones;
- dependencies;
- Kanban;
- Timeline;
- Gantt;
- project health;
- custom fields;
- templates;
- project analytics.

---

# 96. PHASE 3 — Personal Systems

- Goals;
- Habits;
- Routines;
- Weekly Review;
- Monthly Review;
- Focus mode;
- time tracking.

---

# 97. PHASE 4 — Knowledge

- Notes;
- backlinks;
- attachments;
- Files;
- global relationships;
- advanced search.

---

# 98. PHASE 5 — Life Modules

- People;
- Finance;
- Assets;
- Travel;
- Home;
- Learning;
- Journal.

Acestea folosesc core-ul existent.

---

# 99. PHASE 6 — Automation

- rule engine;
- automations;
- smart recurring systems;
- automatic project workflows.

---

# 100. PHASE 7 — Sync & Ecosystem

- stronger cloud sync;
- multi-device;
- imports;
- exports;
- external calendars;
- integrations;
- sharing.

---

# 101. PHASE 8 — Intelligence

- semantic search;
- AI capture;
- AI planning;
- summaries;
- risk analysis;
- smart scheduling.

AI vine DUPĂ ce datele și sistemul sunt solide.

---

# 102. Definiția finală

LIFE OS trebuie să poată răspunde în orice moment:

### Ce fac azi?

Today.

### Ce am săptămâna asta?

Calendar / My Tasks.

### Unde vreau să ajung?

Goals.

### Ce proiecte duc acolo?

Projects.

### Ce mă blochează?

Dependencies / Blocked.

### Ce lucruri repet?

Habits / Routines.

### Ce trebuie să țin minte?

Notes.

### Ce persoane necesită atenție?

People.

### Ce bani trebuie gestionați?

Finance.

### Ce am de revizuit?

Reviews.

### Ce poate sistemul face automat?

Automations.

### Unde găsesc orice?

Global Search.

---

# 103. NORTH STAR

Produsul final trebuie să permită unui om să-și gestioneze:

**timpul + acțiunile + proiectele + obiectivele + rutina + informația + relațiile + banii + documentele**

dintr-un singur sistem,

fără ca fiecare modul să devină o aplicație separată.

---

# 104. REGULA DE ÎNGHEȚARE A DIRECȚIEI

Acest document definește direcția produsului.

Funcțiile pot fi:

- adăugate;
- îmbunătățite;
- amânate;
- eliminate dacă nu sunt utile.

Dar arhitectura conceptuală nu se schimbă:

**Life → Areas → Goals → Projects → Tasks → Time**

cu:

**Habits + Knowledge + People + Resources + Automation**

în jurul ei.

Asta rămâne coloana vertebrală a Life OS.
