/* Starea aplicatiei. Fara importuri, ca sa nu creeze cicluri. */

export const state = {
  modules:{}, tasks:{}, notes:{}, habits:{}, debts:{}, finance:{}, goals:{},
  settings:{currency:"£"},
  view:"azi", ready:false
};

export const ui = { month: "", taskFilter: "open", search: "", calMonth: "", calDay: "" };
