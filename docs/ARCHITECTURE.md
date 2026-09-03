# Architecture Guide

## System Design

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│           User Interface (React)            │
│  ┌────────────────────────────────────────┐ │
│  │              App.tsx                   │ │
│  │  (Main layout, routing, navigation)    │ │
│  └────────────────────────────────────────┘ │
│         ↓                    ↓              │
│  ┌────────────────┐  ┌──────────────────┐  │
│  │   Tasks.tsx    │  │  Calendar.tsx    │  │
│  │  (CRUD tasks)  │  │ (Month display)  │  │
│  └────────────────┘  └──────────────────┘  │
│                                             │
│         ↓ (All components)                 │
│  ┌─────────────────────────────────────┐  │
│  │  LanguageSwitcher.tsx               │  │
│  │  (i18n integration)                 │  │
│  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│        State & Data Layer                   │
│  ┌────────────────────────────────────────┐ │
│  │  React Hooks (useState, useEffect)     │ │
│  │  - Local component state              │ │
│  │  - Form data management               │ │
│  │  - Date/calendar state                │ │
│  └────────────────────────────────────────┘ │
│         ↓                                   │
│  ┌────────────────────────────────────────┐ │
│  │  localStorage                          │ │
│  │  - Persistent task storage            │ │
│  │  - Language preference                │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│    Internationalization Layer (i18n)        │
│  ┌────────────────────────────────────────┐ │
│  │  i18next Configuration                 │ │
│  │  - Language initialization             │ │
│  │  - Resource loading                   │ │
│  │  - Change language handler            │ │
│  └────────────────────────────────────────┘ │
│         ↓                                   │
│  ┌────────────────────────────────────────┐ │
│  │  Translation Resources                 │ │
│  │  - en.json (English)                  │ │
│  │  - ro.json (Romanian)                 │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Component Hierarchy

```
App.tsx (Root)
├── Header Section
│   ├── Title
│   └── LanguageSwitcher
├── Sidebar (Desktop) / Menu (Mobile)
│   ├── Tasks Button
│   └── Calendar Button
└── Main Content Area
    ├── Tasks.tsx (conditional)
    │   ├── Add Task Form
    │   ├── Pending Tasks List
    │   └── Completed Tasks List
    └── Calendar.tsx (conditional)
        ├── Month Navigator
        └── Calendar Grid
```

## Data Flow

### Task Management Flow

```
User Input (Add Task)
        ↓
Tasks Component
        ↓
Form Validation
        ↓
State Update (setTasks)
        ↓
useEffect Hook Triggered
        ↓
localStorage.setItem('tasks', ...)
        ↓
Component Re-render
        ↓
UI Updated
```

### Language Change Flow

```
User Clicks Language Switcher
        ↓
LanguageSwitcher Component
        ↓
i18n.changeLanguage(newLang)
        ↓
localStorage.setItem('language', newLang)
        ↓
i18n Context Updates
        ↓
All Components Using useTranslation Re-render
        ↓
UI Updated in New Language
```

## State Management Strategy

### Local Component State

Tasks Component uses local state for:
- Task list array
- Form visibility
- Form input values

```typescript
const [tasks, setTasks] = useState<Task[]>()
const [showForm, setShowForm] = useState(false)
const [formData, setFormData] = useState({...})
```

### Derived State

- `pendingTasks`: Filtered from main tasks array
- `completedTasks`: Filtered from main tasks array

Benefits:
- ✅ Simple to understand
- ✅ Easy to debug
- ✅ No external state management library needed
- ❌ Not suitable for complex apps with multiple levels

### Persistence Layer

localStorage acts as a simple persistence mechanism:

```
App State ← (sync on mount) ← localStorage
     ↓
useEffect ← (sync on change)
     ↓
localStorage
```

## Type System

### Task Type

```typescript
interface Task {
  id: string;              // Unique identifier
  name: string;            // Task name/title
  dueDate: string;         // ISO date string
  completed: boolean;      // Completion status
}
```

### Component Props

Currently, no props are passed to components. Each component:
- Manages its own state
- Uses i18n hook for translations
- Accesses localStorage directly

Future: Consider prop drilling for testability

## Styling Architecture

### Tailwind CSS Strategy

**Utility-First Approach:**
- Use predefined utility classes
- Minimize custom CSS
- Keep styles in JSX with className attributes

**Color Palette:**
- Primary: Blue (`bg-blue-500`, `text-blue-600`)
- Secondary: Gray (`bg-gray-100`, `text-gray-700`)
- Success: Green (`text-green-500`)
- Danger: Red (`text-red-500`)

**Spacing Scale:**
- Uses Tailwind's default spacing (4px base unit)
- Consistent padding: `p-4`, `p-6`, `py-2`
- Consistent margins: `mb-3`, `gap-2`, `gap-3`

**Responsive Classes:**
- `hidden md:flex` - Hide on mobile, show on desktop
- `w-full lg:col-span-3` - Full width mobile, 3 columns on desktop
- `grid-cols-7` - Always 7 columns for calendar

## Performance Optimizations

### Current Optimizations

1. **Lazy Loading**: Vite's code splitting
2. **Bundle Size**: Tree-shaking unused code
3. **Re-renders**: Efficient React hooks usage
4. **localStorage**: Instant data persistence

### Potential Improvements

1. **Memoization**: useMemo for expensive calculations
2. **Code Splitting**: Dynamic imports for large features
3. **Virtual Lists**: For very large task lists
4. **Caching**: Service workers for offline support

## Internationalization Architecture

### i18next Configuration

```typescript
i18n
  .use(initReactI18next)
  .init({
    resources: { en, ro },
    lng: savedLanguage || 'en',
    interpolation: { escapeValue: false }
  })
```

### Translation Keys

Structure: `[feature]_[element]`
- `app_title`: Application name
- `task_name`: Task name field
- `calendar`: Calendar section

Benefits:
- ✅ Organized and searchable
- ✅ Easy to add new keys
- ✅ Clear relationships between keys

### Language Persistence

```
1. App loads
2. Check localStorage for 'language'
3. If found, use that language
4. If not found, default to 'en'
5. On language change:
   - Save to localStorage
   - Call i18n.changeLanguage()
   - Trigger re-renders
```

## Security Considerations

### Current Security Measures

1. **Input Validation**: Task names are trimmed
2. **XSS Prevention**: React escapes content by default
3. **Storage Security**: Only uses localStorage (no sensitive data)

### Potential Security Enhancements

1. **Sanitization**: Use DOMPurify for user inputs
2. **Authentication**: Add user login system
3. **Encryption**: Encrypt localStorage data
4. **HTTPS**: Deploy with SSL/TLS

## Testing Strategy

### Unit Tests (Future)

```typescript
// Tasks.tsx
- Test add task functionality
- Test delete task functionality
- Test completion toggle
- Test localStorage persistence

// Calendar.tsx
- Test month calculation
- Test navigation
- Test date highlighting

// LanguageSwitcher.tsx
- Test language toggle
- Test localStorage persistence
```

### Integration Tests (Future)

```typescript
- Test full task lifecycle
- Test language switching affects all components
- Test localStorage sync across tabs
```

### E2E Tests (Future)

```typescript
- Test complete user workflows
- Test responsive design
- Test in multiple browsers
```

## Future Architectural Improvements

### Scalability Considerations

1. **State Management**: 
   - Migrate to Zustand or Jotai for global state
   - Benefits: Easier prop drilling, better debugging

2. **API Integration**:
   - Add backend API for cloud sync
   - Implement authentication
   - Handle offline-first sync

3. **Component Library**:
   - Extract reusable components
   - Create style system
   - Implement Storybook for documentation

4. **Feature Modules**:
   - Organize by feature (tasks/, calendar/, etc.)
   - Each module with its own types, components, hooks

5. **Testing Framework**:
   - Set up Jest + React Testing Library
   - Achieve 80%+ code coverage
   - Add CI/CD pipeline

### Recommended Architecture Upgrade Path

```
Current: Simple component-based
         ↓
Phase 1: Extract custom hooks
         ↓
Phase 2: Add global state management
         ↓
Phase 3: Separate by feature modules
         ↓
Phase 4: Add backend API layer
         ↓
Phase 5: Implement comprehensive testing
```

## Deployment Architecture

### Build Output

```
Input: src/ + node_modules/
         ↓
Build: TypeScript → JavaScript
       Vite bundling
         ↓
Output: dist/
  - index.html (15KB)
  - assets/index-*.css (11KB gzipped 2.9KB)
  - assets/index-*.js (207KB gzipped 65KB)
```

### Deployment Options

1. **Static Hosting**:
   - Vercel, Netlify, GitHub Pages
   - Simply upload dist/ folder
   - Perfect for this app

2. **Docker**:
   - Create Dockerfile for containerization
   - Deploy to any container registry

3. **CDN**:
   - Upload assets to CDN
   - Serve from edge locations

## Monitoring & Analytics (Future)

- Error tracking (Sentry)
- Performance monitoring (Web Vitals)
- User analytics (Segment, Mixpanel)
- Crash reporting (Rollbar)
