/**
 * §ajutor — FORMA unui subiect de ajutor, singură, ca grupurile de text și registrul să nu se
 * importe unul pe altul în cerc.
 *
 * ⚠️ Comentariile despre CE se scrie într-un subiect (și ce nu) au rămas în `helpContent.ts`, lângă
 * registru — acolo se uită cineva când adaugă un ecran.
 */
export type HelpTopic = {
  /** Shown as the panel heading. Matches the screen's own title. */
  title: string;
  /** One or two sentences: what this screen is FOR. Not what it contains. */
  whatItIs: string;
  /** The things you actually come here to do. */
  steps?: { label: string; detail: string }[];
  /** Consequences that are invisible until they bite. Kept short and specific. */
  warnings?: string[];
};

