import {
  BarChart3, Boxes, Briefcase, Building2, CalendarClock, CircleDollarSign,
  ClipboardCheck, FileText, LayoutDashboard, Megaphone, MessageSquare, Receipt,
  Settings, ShieldCheck, Sparkles, Star, UserCheck, Users, WalletCards,
} from 'lucide-react';

export type AchuSection = {
  id: string;
  label: string;
  description: string;
  group: string;
  icon: typeof LayoutDashboard;
  actions?: string[];
};

export const achuSections: AchuSection[] = [
  { id: 'overview', label: 'Overview', description: 'Live view of the business.', group: 'Home', icon: LayoutDashboard },
  { id: 'action-centre', label: 'Action Centre', description: 'Items that need attention.', group: 'Home', icon: Sparkles },
  { id: 'customers', label: 'Customers', description: 'Customer records and history.', group: 'Customers', icon: Users, actions: ['Add customer', 'Import customers'] },
  { id: 'properties', label: 'Properties', description: 'Service addresses and access details.', group: 'Customers', icon: Building2, actions: ['Add property'] },
  { id: 'quotes', label: 'Quotes', description: 'Quote requests, pricing and approvals.', group: 'Customers', icon: FileText, actions: ['Create quote'] },
  { id: 'services', label: 'Services', description: 'Cleaning services and pricing catalogue.', group: 'Customers', icon: Briefcase, actions: ['Add service'] },
  { id: 'jobs', label: 'Jobs', description: 'One-off and recurring cleaning jobs.', group: 'Operations', icon: ClipboardCheck, actions: ['Create job'] },
  { id: 'schedule', label: 'Schedule', description: 'Visits, availability and assignments.', group: 'Operations', icon: CalendarClock, actions: ['Schedule visit'] },
  { id: 'subscriptions', label: 'Subscriptions', description: 'Prepaid cleaning terms and recurring services.', group: 'Operations', icon: WalletCards, actions: ['Create subscription'] },
  { id: 'cleaners', label: 'Cleaners', description: 'Cleaner profiles and compliance.', group: 'Workforce', icon: UserCheck, actions: ['Add cleaner'] },
  { id: 'time', label: 'Timesheets', description: 'Working time, attendance and approvals.', group: 'Workforce', icon: CalendarClock, actions: ['Add time entry'] },
  { id: 'payroll', label: 'Payroll', description: 'Pay runs and labour costs.', group: 'Workforce', icon: CircleDollarSign, actions: ['Start pay run'] },
  { id: 'invoices', label: 'Invoices', description: 'Customer invoices and credit notes.', group: 'Finance', icon: Receipt, actions: ['Create invoice'] },
  { id: 'payments', label: 'Payments', description: 'Payments, refunds and balances.', group: 'Finance', icon: WalletCards, actions: ['Record payment'] },
  { id: 'expenses', label: 'Expenses', description: 'Business expenses and receipts.', group: 'Finance', icon: CircleDollarSign, actions: ['Add expense'] },
  { id: 'quality', label: 'Quality', description: 'Checks, complaints, incidents and re-cleans.', group: 'Quality', icon: ShieldCheck, actions: ['Log issue'] },
  { id: 'reviews', label: 'Reviews', description: 'Customer feedback and public reviews.', group: 'Quality', icon: Star, actions: ['Request review'] },
  { id: 'messages', label: 'Messages', description: 'Customer and workforce communication.', group: 'Communication', icon: MessageSquare, actions: ['New message'] },
  { id: 'campaigns', label: 'Campaigns', description: 'Offers and customer communication campaigns.', group: 'Communication', icon: Megaphone, actions: ['Create campaign'] },
  { id: 'documents', label: 'Documents', description: 'Contracts, policies and uploaded files.', group: 'Resources', icon: FileText, actions: ['Upload document'] },
  { id: 'inventory', label: 'Equipment', description: 'Equipment, stock and vehicles.', group: 'Resources', icon: Boxes, actions: ['Add item'] },
  { id: 'reports', label: 'Reports', description: 'Operations, finance and workforce reporting.', group: 'System', icon: BarChart3 },
  { id: 'settings', label: 'Settings', description: 'ACHU configuration and business rules.', group: 'System', icon: Settings },
];

export const achuGroups = [...new Set(achuSections.map((section) => section.group))];
