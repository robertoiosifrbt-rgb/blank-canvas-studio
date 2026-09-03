# API Reference

## Component API

### App Component

**File**: `src/App.tsx`

**Purpose**: Main application component that manages view switching and layout.

**Props**: None (root component)

**State**:
```typescript
currentView: 'tasks' | 'calendar'
mobileMenuOpen: boolean
```

**Features**:
- Navigation between Tasks and Calendar views
- Responsive header with language switcher
- Mobile menu toggle
- Desktop sidebar navigation
- Sticky header

**Example Usage**:
```tsx
<App />
```

---

### Tasks Component

**File**: `src/components/Tasks.tsx`

**Purpose**: Manage and display tasks with CRUD operations.

**Props**: None

**State**:
```typescript
tasks: Task[]
showForm: boolean
formData: { name: string; dueDate: string }
```

**Type Definitions**:
```typescript
interface Task {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
}
```

**Methods**:

#### `addTask()`
Creates a new task if form data is valid.

```typescript
function addTask() {
  if (formData.name.trim()) {
    // Creates task with:
    // - Auto-generated ID
    // - Trimmed name
    // - Due date (optional)
    // - Completed: false
  }
}
```

#### `toggleTask(id: string)`
Toggles the completion status of a task.

```typescript
toggleTask('task-123') // Flips completed boolean
```

#### `deleteTask(id: string)`
Removes a task from the list.

```typescript
deleteTask('task-123') // Removes from tasks array
```

**Hooks**:

#### `useEffect` - localStorage Sync
```typescript
useEffect(() => {
  localStorage.setItem('tasks', JSON.stringify(tasks))
}, [tasks])
```

Automatically saves tasks to localStorage whenever the tasks array changes.

**Storage**:
- **Key**: `'tasks'`
- **Value**: JSON stringified array of Task objects
- **Scope**: Browser localStorage

**Rendered Elements**:
- Task form with input fields
- Pending tasks section
- Completed tasks section
- Add task button
- Delete buttons per task
- Complete/uncomplete buttons per task

**Example Usage**:
```tsx
<Tasks />
```

**Styling Classes**:
- `bg-white rounded-lg shadow-md p-6` - Main container
- `flex items-center gap-3` - Task items
- `text-green-500` - Completed indicator
- `text-red-500` - Delete button hover

---

### Calendar Component

**File**: `src/components/Calendar.tsx`

**Purpose**: Display an interactive calendar with month navigation.

**Props**: None

**State**:
```typescript
currentDate: Date
```

**Type Definitions**:
```typescript
interface Day {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}
```

**Methods**:

#### `getDaysInMonth(date: Date): Day[]`
Calculates all days to display for a given month.

```typescript
// Returns 42 days (6 weeks × 7 days)
// Includes trailing days from prev/next months
const days = getDaysInMonth(new Date())
```

**Parameters**:
- `date`: Date object for the month to calculate

**Returns**: Array of Day objects with metadata

#### `handlePrevMonth()`
Navigates to the previous month.

```typescript
handlePrevMonth() // Decrements month by 1
```

#### `handleNextMonth()`
Navigates to the next month.

```typescript
handleNextMonth() // Increments month by 1
```

**Features**:
- Full month calendar view (7 columns × 6 rows)
- Correct day-of-week alignment
- Today's date highlighted in blue
- Previous/next month's days grayed out
- Month and year display
- Arrow buttons for navigation

**Styling Classes**:
- `bg-white rounded-lg shadow-md` - Container
- `grid grid-cols-7` - Calendar grid
- `bg-blue-500 text-white` - Today's date
- `bg-gray-50` - Current month
- `bg-gray-100` - Other months

**Example Usage**:
```tsx
<Calendar />
```

---

### LanguageSwitcher Component

**File**: `src/components/LanguageSwitcher.tsx`

**Purpose**: Toggle between English and Romanian languages.

**Props**: None

**Methods**:

#### `toggleLanguage()`
Switches the current language between English and Romanian.

```typescript
toggleLanguage() {
  const newLang = i18n.language === 'en' ? 'ro' : 'en'
  i18n.changeLanguage(newLang)
  localStorage.setItem('language', newLang)
}
```

**Hooks**:

#### `useTranslation()`
Access i18n functionality and translation function.

```typescript
const { i18n, t } = useTranslation()
```

**Storage**:
- **Key**: `'language'`
- **Value**: `'en'` or `'ro'`
- **Persistence**: Saved to localStorage

**Styling Classes**:
- `flex items-center gap-2` - Button layout
- `bg-gray-100 hover:bg-gray-200` - Button styling
- `px-4 py-2 rounded-lg` - Padding and rounding

**Example Usage**:
```tsx
<LanguageSwitcher />
```

---

## i18n API

### Configuration

**File**: `src/i18n/config.ts`

#### Initialize i18n
```typescript
i18n
  .use(initReactI18next)
  .init({
    resources,      // Translation resources
    lng,           // Current language
    interpolation: {
      escapeValue: false  // XSS prevention
    }
  })
```

### Usage Hook

#### `useTranslation()`
React hook for accessing translations.

```typescript
const { t, i18n } = useTranslation()

// Get translation
const text = t('app_title') // Returns localized string

// Change language
i18n.changeLanguage('ro') // Switch to Romanian

// Get current language
const currentLang = i18n.language // 'en' or 'ro'
```

### Translation Keys

#### English Keys (`en.json`)
```json
{
  "app_title": "Tasks & Calendar",
  "calendar": "Calendar",
  "tasks": "Tasks",
  "settings": "Settings",
  "language": "Language",
  "english": "English",
  "romanian": "Romanian",
  "add_task": "Add Task",
  "task_name": "Task name",
  "due_date": "Due date",
  "cancel": "Cancel",
  "save": "Save",
  "delete": "Delete",
  "complete": "Complete",
  "no_tasks": "No tasks yet",
  "today": "Today",
  "tomorrow": "Tomorrow",
  "this_week": "This week",
  "overdue": "Overdue",
  "completed": "Completed",
  "pending": "Pending"
}
```

#### Romanian Keys (`ro.json`)
```json
{
  "app_title": "Sarcini & Calendar",
  "calendar": "Calendar",
  "tasks": "Sarcini",
  "settings": "Setări",
  "language": "Limbă",
  "english": "Engleză",
  "romanian": "Română",
  "add_task": "Adauga sarcină",
  "task_name": "Nume sarcină",
  "due_date": "Data scadenţei",
  "cancel": "Anulare",
  "save": "Salvare",
  "delete": "Ştergere",
  "complete": "Completat",
  "no_tasks": "Nicio sarcină încă",
  "today": "Azi",
  "tomorrow": "Mâine",
  "this_week": "Această săptămână",
  "overdue": "Expirat",
  "completed": "Finalizat",
  "pending": "În aşteptare"
}
```

---

## Utility Functions

### Date Formatting

**Used in**: Tasks component

```typescript
new Date(task.dueDate).toLocaleDateString()
// Returns date formatted according to browser locale
```

**Example Outputs**:
- en-US: "8/10/2026"
- ro-RO: "10.08.2026"

### localStorage API

#### Saving Tasks
```typescript
localStorage.setItem('tasks', JSON.stringify(tasks))
```

#### Loading Tasks
```typescript
const saved = localStorage.getItem('tasks')
const tasks = saved ? JSON.parse(saved) : []
```

#### Saving Language
```typescript
localStorage.setItem('language', 'ro')
```

#### Loading Language
```typescript
const lang = localStorage.getItem('language') || 'en'
```

---

## Event Handlers

### Button Click Handlers

#### Add Task
```typescript
onClick={() => setShowForm(!showForm)}
```

#### Save Task
```typescript
onClick={addTask}
```

#### Cancel Form
```typescript
onClick={() => {
  setShowForm(false)
  setFormData({ name: '', dueDate: '' })
}}
```

#### Delete Task
```typescript
onClick={() => deleteTask(task.id)}
```

#### Complete Task
```typescript
onClick={() => toggleTask(task.id)}
```

#### Navigate Month
```typescript
onClick={handlePrevMonth}  // Previous month
onClick={handleNextMonth}  // Next month
```

### Form Input Handlers

#### Task Name Input
```typescript
onChange={(e) => setFormData({ ...formData, name: e.target.value })}
```

#### Due Date Input
```typescript
onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
```

---

## React Hooks Reference

### useState

**Tasks Component**:
```typescript
const [tasks, setTasks] = useState<Task[]>(() => {
  const saved = localStorage.getItem('tasks')
  return saved ? JSON.parse(saved) : []
})
```

**Calendar Component**:
```typescript
const [currentDate, setCurrentDate] = useState(new Date())
```

### useEffect

**Tasks Component**:
```typescript
useEffect(() => {
  localStorage.setItem('tasks', JSON.stringify(tasks))
}, [tasks]) // Runs when tasks changes
```

### useTranslation (i18next)

**All Components**:
```typescript
const { t, i18n } = useTranslation()
// t: Translation function
// i18n: i18n instance with language switching
```

---

## Error Handling

### Task Validation
```typescript
if (formData.name.trim()) {
  // Only add if name is not empty
}
```

### localStorage Fallback
```typescript
const saved = localStorage.getItem('tasks')
const tasks = saved ? JSON.parse(saved) : []
// Returns empty array if localStorage fails
```

### Language Fallback
```typescript
const language = localStorage.getItem('language') || 'en'
// Defaults to English if not set
```

---

## Performance Metrics

### Bundle Size
- Total: 207 KB (uncompressed)
- Gzipped: 65.6 KB
- CSS: 11.24 KB (2.91 KB gzipped)
- JavaScript: Main bundle

### Rendering Performance
- No external API calls
- Simple state updates
- Efficient array filtering
- Fast re-renders with React hooks

---

## Browser Compatibility

### Supported Features
- ES2020 target
- LocalStorage API
- CSS Grid and Flexbox
- Modern JavaScript (const, arrow functions, etc.)

### Tested Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
