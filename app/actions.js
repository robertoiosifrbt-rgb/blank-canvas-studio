import { modules } from "./modules.js";

import { navActions } from "./actions/nav.js";
import { modulesActions } from "./actions/modules.js";
import { financeActions } from "./actions/finance.js";
import { debtsActions } from "./actions/debts.js";
import { tasksActions } from "./actions/tasks.js";
import { goalsActions } from "./actions/goals.js";
import { habitsActions } from "./actions/habits.js";
import { notesActions } from "./actions/notes.js";
import { appActions } from "./actions/app.js";

/* Un fisier per domeniu; aici se aduna intr-o singura harta. */
export const ACT = Object.assign({}, navActions, modulesActions, financeActions, debtsActions, tasksActions, goalsActions, habitsActions, notesActions, appActions);

