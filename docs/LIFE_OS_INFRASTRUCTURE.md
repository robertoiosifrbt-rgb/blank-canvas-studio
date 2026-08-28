# Life OS Infrastructure Skeleton

This is the implementation skeleton for the frozen Life OS direction.

## Core
- canonical entity model for Areas, Goals, Projects, Milestones, Tasks, Events, Habits, Routines, Notes, People, Finance, Assets, Files, Journal, Reviews, Tags, Calendars, Automations and Templates
- relation graph and backlinks
- central repository and indexes
- pluggable persistence adapter
- local-storage adapter for transition
- event bus
- entity service layer
- archive/trash hooks
- validation foundation
- migration framework

## Cross-cutting extension points
- search provider
- notifications provider
- sync provider
- automation engine
- analytics sink

## Module shell
Today, Areas, Goals, Projects, Milestones, Tasks, Calendar, Events, Habits, Routines, Notes, People, Finance, Assets, Files, Travel, Home, Health, Learning, Journal, Reviews, Search, Focus, Time Tracking, Analytics, Automations, Templates, Notifications, Integrations and AI are registered as modules.

## Migration rule
Existing Tasks/My Tasks/Calendar screens are intentionally untouched in this commit. The new core runs in parallel until each old screen is migrated to the canonical repository. This avoids a destructive big-bang rewrite while still creating the entire architectural skeleton at once.

## Next implementation layer
1. bootstrap a singleton repository in the app shell
2. migrate existing localStorage task/calendar data into schema v1
3. point Tasks, My Tasks and Calendar to the shared repository
4. add Today and Projects against the same model
5. implement concrete search/notification/sync adapters

No module gets a second database or duplicate task model.
