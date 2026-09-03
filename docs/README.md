# Tasks & Calendar - Documentation

## Project Overview

**Tasks & Calendar** is a modern web application built with React and TypeScript that provides task management and calendar functionality with multi-language support for English and Romanian.

### Key Features

- ✅ **Task Management**: Create, edit, delete, and complete tasks
- 📅 **Interactive Calendar**: Month view with navigation
- 🌍 **Multi-Language Support**: English (EN) and Romanian (RO) translations
- 💾 **Local Storage**: Persistent task storage in browser
- 📱 **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- 🎨 **Modern UI**: Clean and intuitive user interface

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Internationalization**: i18next & react-i18next
- **Icons**: Lucide React
- **State Management**: React Hooks

## Project Structure

```
blank-canvas-studio/
├── src/
│   ├── components/
│   │   ├── Calendar.tsx         # Calendar component
│   │   ├── Tasks.tsx            # Tasks management component
│   │   └── LanguageSwitcher.tsx # Language toggle component
│   ├── i18n/
│   │   ├── config.ts            # i18n configuration
│   │   └── locales/
│   │       ├── en.json          # English translations
│   │       └── ro.json          # Romanian translations
│   ├── App.tsx                  # Main app component
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles
├── public/
├── docs/                        # Documentation
├── index.html                   # HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn installed

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd blank-canvas-studio
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Development

### Running the Development Server

```bash
npm run dev
```

The application will start on `http://localhost:5173` with hot module replacement enabled.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Features Documentation

### 1. Tasks Management (`src/components/Tasks.tsx`)

#### Features:
- ✨ Add new tasks with optional due dates
- ✓ Mark tasks as completed
- 🗑️ Delete tasks
- 📂 Organize tasks by status (Pending/Completed)
- 💾 Auto-save to localStorage

#### How to Use:
1. Click "Add Task" button
2. Enter task name and optional due date
3. Click "Save" to create the task
4. Click the circle icon to mark as complete
5. Click trash icon to delete

### 2. Calendar (`src/components/Calendar.tsx`)

#### Features:
- 📆 Full month view
- ⬅️➡️ Navigate between months
- 🔵 Today's date highlighted
- 📱 Responsive grid layout

#### How to Use:
1. Use left/right arrows to navigate months
2. Today's date is highlighted in blue
3. Click on dates to view associated tasks (future enhancement)

### 3. Language Switcher (`src/components/LanguageSwitcher.tsx`)

#### Features:
- 🌍 Toggle between English and Romanian
- 💾 Preferences saved to localStorage
- 🎯 Language persists across sessions

#### How to Use:
1. Click the globe icon in the header
2. Language switches instantly
3. All content updates in selected language

## Internationalization (i18n) Setup

### Configuration File (`src/i18n/config.ts`)

- Initializes i18next with React binding
- Sets up language resources
- Loads language preference from localStorage
- Defaults to English if no preference found

### Translation Files

**English** (`src/i18n/locales/en.json`):
- 18 translation keys
- Complete UI text in English

**Romanian** (`src/i18n/locales/ro.json`):
- 18 translation keys matching English
- Complete UI text in Romanian

### Adding New Translations

1. Add key to `en.json`:
```json
{
  "new_key": "New text in English"
}
```

2. Add same key to `ro.json`:
```json
{
  "new_key": "Noul text în română"
}
```

3. Use in component:
```tsx
const { t } = useTranslation();
<h1>{t('new_key')}</h1>
```

## Component Details

### App.tsx (Main Application)

**Responsibilities:**
- Main layout and navigation
- View switching (Tasks/Calendar)
- Header with language switcher
- Responsive sidebar navigation (desktop)
- Mobile menu toggle

**Props:** None (root component)

### Calendar.tsx

**Props:** None

**State:**
- `currentDate`: Currently viewed month

**Features:**
- Month calculation with correct day-of-week alignment
- Handles days from previous/next months
- Highlights current day
- Month navigation with arrow buttons

### Tasks.tsx

**Props:** None

**State:**
- `tasks`: Array of Task objects
- `showForm`: Form visibility toggle
- `formData`: Form input values

**Features:**
- Create tasks with name and due date
- Toggle task completion status
- Delete tasks
- Separate display for pending/completed
- localStorage persistence
- Date formatting based on locale

### LanguageSwitcher.tsx

**Props:** None

**Features:**
- Displays current/alternate language
- Uses i18n to change language
- Saves preference to localStorage
- Globe icon for easy identification

## Styling

### Tailwind CSS

The application uses Tailwind CSS for styling:

- **Colors**: Blue theme with gray accents
- **Components**: Pre-built utility classes
- **Responsive**: Mobile-first approach
- **Configuration**: `tailwind.config.js`

### Responsive Breakpoints

- **Mobile**: < 768px (full width, hamburger menu)
- **Tablet**: 768px - 1024px (adaptive layout)
- **Desktop**: > 1024px (sidebar + main content)

## Storage

### localStorage Keys

- `tasks`: Array of task objects (JSON stringified)
- `language`: Selected language code (en/ro)

**Note:** Data is stored locally in the browser. Clearing browser data will reset the application.

## Performance Considerations

- ✅ Lightweight dependencies
- ✅ Optimized bundle size (~207KB uncompressed, ~65KB gzipped)
- ✅ Efficient re-renders with React hooks
- ✅ No unnecessary external API calls

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Future Enhancements

- [ ] Task categories/tags
- [ ] Recurring tasks
- [ ] Task reminders/notifications
- [ ] Calendar integration with tasks
- [ ] Dark mode support
- [ ] User authentication
- [ ] Cloud sync (Firebase/Supabase)
- [ ] Time zone support
- [ ] Multiple calendars
- [ ] Export/Import functionality

## Troubleshooting

### Build Issues

If you encounter build errors:
1. Delete `node_modules` and `package-lock.json`
2. Run `npm install`
3. Try building again: `npm run build`

### Language Not Persisting

Check browser's localStorage:
1. Open DevTools (F12)
2. Go to Application → Storage → localStorage
3. Verify `language` key exists
4. Clear if corrupted and refresh

### Tasks Not Saving

1. Check localStorage in DevTools
2. Ensure browser allows localStorage
3. Check available disk space
4. Try clearing cache and reloading

## Contributing

When adding new features:
1. Create new component in `src/components/`
2. Add translation keys to both `en.json` and `ro.json`
3. Update this documentation
4. Test in both languages
5. Verify responsive design
6. Run linter: `npm run lint`

## License

[Add your license information here]

## Support

For issues and questions, please refer to the project repository.
