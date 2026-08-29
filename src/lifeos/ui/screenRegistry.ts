export type LifeOSScreen = {
  id: string;
  title: string;
  description: string;
  group: string;
  sections?: string[];
};

export const lifeOSGroups = [
  'Home', 'Plan', 'Do', 'Organise', 'Life', 'Review', 'System', 'Intelligence', 'Settings'
] as const;

export const lifeOSScreens: LifeOSScreen[] = [
  { id: 'today', title: 'Today', group: 'Home', description: 'What needs attention now.', sections: ['Daily Message', 'Morning', 'Attention', 'Today timeline', 'Quick capture', 'End of day'] },
  { id: 'dashboard', title: 'Dashboard', group: 'Home', description: 'Custom overview of your Life OS.', sections: ['Today', 'Calendar', 'Goals', 'Active Projects', 'Overdue', 'Habits', 'Finance', 'Time', 'Inbox', 'Upcoming'] },
  { id: 'inbox', title: 'Inbox', group: 'Home', description: 'Fast capture with zero organisation required.', sections: ['Quick capture', 'Unprocessed items', 'Convert to task/note/event/project/reminder/expense/follow-up'] },

  { id: 'areas', title: 'Life Areas', group: 'Plan', description: 'The highest-level areas of your life.', sections: ['Overview', 'Goals', 'Projects', 'Notes', 'Files', 'People', 'Statistics'] },
  { id: 'goals', title: 'Goals', group: 'Plan', description: 'Long and medium-term outcomes.', sections: ['Lifetime', 'Yearly', 'Quarterly', 'Monthly', 'Custom', 'Progress'] },
  { id: 'projects', title: 'Projects', group: 'Plan', description: 'Finite outcomes with tasks, milestones and dependencies.', sections: ['Overview', 'List', 'Board', 'Timeline', 'Gantt', 'Calendar', 'Milestones', 'Files', 'Notes', 'Activity', 'Analytics'] },
  { id: 'milestones', title: 'Milestones', group: 'Plan', description: 'Important project checkpoints.', sections: ['Upcoming', 'At risk', 'Completed', 'Dependencies'] },
  { id: 'templates', title: 'Templates', group: 'Plan', description: 'Reusable structures for projects and life systems.', sections: ['Projects', 'Tasks', 'Routines', 'Trips', 'Checklists', 'Notes', 'Reviews'] },

  { id: 'myTasks', title: 'My Tasks', group: 'Do', description: 'All actionable work across the system.', sections: ['Inbox', 'Overdue', 'Today', 'Tomorrow', 'This Week', 'Next Week', 'Later', 'Waiting', 'Blocked', 'Someday', 'Completed'] },
  { id: 'tasks', title: 'Tasks', group: 'Do', description: 'The central action object of Life OS.', sections: ['List', 'Hierarchy', 'Statuses', 'Dependencies', 'Recurring', 'Archive'] },
  { id: 'calendar', title: 'Calendar', group: 'Do', description: 'Time view across all Life OS objects.', sections: ['Day', 'Week', 'Month', 'Agenda', 'Timeline'] },
  { id: 'events', title: 'Events', group: 'Do', description: 'Time-bound events separate from tasks.', sections: ['Upcoming', 'Recurring', 'Past', 'By calendar'] },
  { id: 'focus', title: 'Focus Mode', group: 'Do', description: 'One task, no noise.', sections: ['Current task', 'Timer', 'Subtasks', 'Notes', 'Files', 'Pomodoro'] },
  { id: 'time', title: 'Time Tracking', group: 'Do', description: 'Track actual time by task, project and area.', sections: ['Timer', 'Today', 'Week', 'By project', 'By area', 'History'] },

  { id: 'habits', title: 'Habits', group: 'Organise', description: 'Repeated behaviours with targets and streaks.', sections: ['Today', 'All habits', 'Streaks', 'Weekly', 'Monthly', 'Metrics'] },
  { id: 'routines', title: 'Routines', group: 'Organise', description: 'Reusable groups of repeated actions.', sections: ['Morning', 'Evening', 'Custom', 'Generated tasks'] },
  { id: 'notes', title: 'Notes & Knowledge', group: 'Organise', description: 'Connected information and personal knowledge.', sections: ['Quick notes', 'Project notes', 'Meeting notes', 'References', 'Ideas', 'Backlinks'] },
  { id: 'files', title: 'Files & Documents', group: 'Organise', description: 'Central file library linked to any object.', sections: ['Personal', 'Finance', 'Contracts', 'Receipts', 'Projects', 'Insurance', 'Property', 'Vehicle', 'Certificates'] },
  { id: 'people', title: 'People', group: 'Organise', description: 'Personal CRM and relationship follow-ups.', sections: ['All people', 'Birthdays', 'Follow-ups', 'Recently contacted', 'Needs attention'] },
  { id: 'search', title: 'Global Search', group: 'Organise', description: 'Find anything across the entire Life OS.', sections: ['All', 'Tasks', 'Projects', 'Goals', 'Events', 'Notes', 'People', 'Files', 'Habits', 'Finance'] },
  { id: 'views', title: 'Custom Views', group: 'Organise', description: 'Saved filters and reusable perspectives.', sections: ['Saved views', 'Create view', 'Filters', 'Sort', 'Group'] },

  { id: 'finance', title: 'Finance', group: 'Life', description: 'Personal financial organisation.', sections: ['Dashboard', 'Transactions', 'Bills', 'Subscriptions', 'Budgets', 'Savings goals'] },
  { id: 'assets', title: 'Assets', group: 'Life', description: 'Important things you own and maintain.', sections: ['All assets', 'Warranties', 'Maintenance', 'Documents'] },
  { id: 'home', title: 'Home', group: 'Life', description: 'Home maintenance and household organisation.', sections: ['Maintenance', 'Appliances', 'Warranties', 'Chores', 'Utilities', 'Inventory', 'Documents'] },
  { id: 'travel', title: 'Travel', group: 'Life', description: 'Trips, bookings, itinerary and travel tasks.', sections: ['Trips', 'Itinerary', 'Bookings', 'Accommodation', 'Flights', 'Budget', 'Packing', 'Documents'] },
  { id: 'health', title: 'Health & Fitness', group: 'Life', description: 'Organisation for workouts, appointments and progress.', sections: ['Workouts', 'Appointments', 'Measurements', 'Goals', 'Routines', 'Reminders', 'Documents'] },
  { id: 'learning', title: 'Learning', group: 'Life', description: 'Courses, study sessions and learning goals.', sections: ['Courses', 'Lessons', 'Progress', 'Notes', 'Study sessions', 'Deadlines', 'Certificates'] },
  { id: 'business', title: 'Business', group: 'Life', description: 'Companies and business operations managed inside Life OS.', sections: ['ACHU'] },
  { id: 'achu', title: 'ACHU', group: 'Life', description: 'ACHU business operating system.', sections: ['Overview', 'Customers', 'Operations', 'Workforce', 'Finance', 'Quality', 'Assets', 'Reports'] },
  { id: 'journal', title: 'Journal', group: 'Life', description: 'Daily journal and historical reflection.', sections: ['Today', 'History', 'Highlights', 'Problems', 'Gratitude', 'Attachments'] },
  { id: 'family', title: 'Family Mode', group: 'Life', description: 'Shared family organisation while preserving private areas.', sections: ['Calendar', 'Chores', 'Shopping', 'Bills', 'Trips', 'Documents'] },

  { id: 'weeklyReview', title: 'Weekly Review', group: 'Review', description: 'Guided weekly reset and planning workflow.', sections: ['Process Inbox', 'Overdue', 'Projects', 'Next actions', 'Goals', 'Previous week', 'Next week', 'Finance', 'Habits', 'Priorities'] },
  { id: 'monthlyReview', title: 'Monthly Review', group: 'Review', description: 'Monthly reflection and planning.', sections: ['Goals', 'Finances', 'Habits', 'Projects', 'Time', 'Wins', 'Failures', 'Next month'] },
  { id: 'analytics', title: 'Analytics', group: 'Review', description: 'Personal analytics across the system.', sections: ['Completion', 'Overdue', 'Planned vs completed', 'Time by area', 'Time by project', 'Goals', 'Habits', 'Project velocity', 'Calendar load', 'Spending'] },
  { id: 'activity', title: 'Activity History', group: 'Review', description: 'Timeline of changes across Life OS objects.', sections: ['Created', 'Edited', 'Status changes', 'Comments', 'Files', 'Completion'] },

  { id: 'automations', title: 'Automations', group: 'System', description: 'WHEN / IF / THEN workflows across Life OS.', sections: ['Active', 'Paused', 'Templates', 'Runs', 'Create automation'] },
  { id: 'rules', title: 'Rules Engine', group: 'System', description: 'Shared trigger-condition-action engine.', sections: ['Triggers', 'Conditions', 'Actions', 'History'] },
  { id: 'notifications', title: 'Notification Centre', group: 'System', description: 'Local, push and in-app notifications.', sections: ['Unread', 'Read', 'Dismissed', 'Reminder settings'] },
  { id: 'archive', title: 'Archive', group: 'System', description: 'Archived items remain restorable.', sections: ['All', 'Tasks', 'Projects', 'Notes', 'Other'] },
  { id: 'trash', title: 'Trash', group: 'System', description: 'Soft-deleted items awaiting restoration or deletion.', sections: ['Deleted recently', 'Restore', 'Delete permanently'] },
  { id: 'backup', title: 'Backup & Restore', group: 'System', description: 'Protect and restore Life OS data.', sections: ['Automatic backups', 'Manual backup', 'Restore', 'Backup history'] },
  { id: 'importExport', title: 'Import & Export', group: 'System', description: 'Move data in and out without locking the user in.', sections: ['Export JSON', 'Export CSV', 'Export Markdown', 'Export ICS', 'Reports', 'Import CSV', 'Import JSON', 'Import ICS'] },
  { id: 'integrations', title: 'Integrations', group: 'System', description: 'Optional external providers around the core.', sections: ['Calendars', 'Email', 'Drive', 'GitHub', 'Slack', 'Weather', 'Maps'] },
  { id: 'sync', title: 'Sync & Devices', group: 'System', description: 'Local-first multi-device sync foundation.', sections: ['This device', 'Other devices', 'Sync status', 'Conflicts'] },

  { id: 'ai', title: 'AI Assistant', group: 'Intelligence', description: 'Assistant layer over solid Life OS data.', sections: ['Capture', 'Planning', 'Daily Brief', 'Weekly Review', 'Search', 'Suggestions'] },
  { id: 'aiSearch', title: 'AI Search', group: 'Intelligence', description: 'Semantic search across your data.', sections: ['Ask Life OS', 'Recent questions', 'Sources'] },
  { id: 'aiPlanning', title: 'AI Planning', group: 'Intelligence', description: 'Propose Goals → Projects → Milestones → Tasks for approval.', sections: ['New plan', 'Drafts', 'Approved plans'] },

  { id: 'account', title: 'Account', group: 'Settings', description: 'Account, devices, sessions and security.', sections: ['Profile', 'Devices', 'Sessions', 'Security'] },
  { id: 'settings', title: 'Settings', group: 'Settings', description: 'Global Life OS preferences.', sections: ['General', 'Appearance', 'Calendars', 'Notifications', 'Privacy', 'Data', 'Advanced'] },
  { id: 'customFields', title: 'Custom Fields', group: 'Settings', description: 'Reusable fields across supported objects.', sections: ['Text', 'Number', 'Currency', 'Percentage', 'Date', 'Dropdown', 'Multi-select', 'Checkbox', 'Person', 'Link', 'Formula'] },
  { id: 'tagsContexts', title: 'Tags & Contexts', group: 'Settings', description: 'Cross-system labels and GTD-style contexts.', sections: ['Tags', 'Contexts', 'Energy levels'] },
];

export const getScreen = (id: string) => lifeOSScreens.find((screen) => screen.id === id) ?? lifeOSScreens[0];
