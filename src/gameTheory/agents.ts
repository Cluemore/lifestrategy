import type {FinancialState, StrategyVector} from '../game/types';
export type Agent={id:string;name:string;short:string;month:number;quote:string;color:string;portrait:string;weights:StrategyVector;debtSensitivity:number;goalSensitivity:number};
export const AGENTS:Agent[]=[
 {id:'sam',name:'Conservative Sam',short:'Sam',month:7,quote:"Freedom is surviving when something goes wrong.",color:'#78c8ae',portrait:'👨🏽‍💼',weights:{security:.40,savings:.35,growth:.15,lifestyle:.10},debtSensitivity:.32,goalSensitivity:.14},
 {id:'gia',name:'Growth Gia',short:'Gia',month:8,quote:"A rupee can buy comfort—or build tomorrow.",color:'#f2b954',portrait:'👩🏾‍🎓',weights:{security:.15,savings:.15,growth:.55,lifestyle:.15},debtSensitivity:.18,goalSensitivity:.25},
 {id:'leo',name:'Lifestyle Leo',short:'Leo',month:9,quote:"A plan with no joy is just another bill.",color:'#f08e9f',portrait:'🧑🏽‍🎨',weights:{security:.10,savings:.10,growth:.15,lifestyle:.65},debtSensitivity:.12,goalSensitivity:.18},
 {id:'maya',name:'Family Maya',short:'Maya',month:10,quote:"We plan so the people we love can breathe easier.",color:'#9a8bd6',portrait:'👩🏽‍⚕️',weights:{security:.35,savings:.30,growth:.20,lifestyle:.15},debtSensitivity:.38,goalSensitivity:.25},
];

export function recommendationFor(agent: Agent, state: FinancialState) {
 const coverage=state.emergencyFund/Math.max(state.essentialExpenses,1);
 if(agent.id==='sam') return coverage<1
  ? 'Your emergency cover is below one month. Build the safety buffer before taking more risk.'
  : coverage<3
   ? 'You have started a buffer. Keep building toward three months of essential expenses.'
   : 'Your safety base is strong. You can make room for growth without losing resilience.';
 if(agent.id==='gia') return state.debt>state.monthlyIncome*.25
  ? 'Clear expensive debt before adding more risk. Growth should not be fragile.'
  : state.investments<state.monthlyIncome
   ? 'A steady investment contribution now can compound into more choices later.'
   : 'Your portfolio has momentum. Pair it with a practical new skill this month.';
 if(agent.id==='leo') return state.cash<1000
  ? 'Joy still needs a boundary this month—choose one small experience, not every experience.'
  : 'Keep a little room for life. A plan you can enjoy is one you can sustain.';
 return state.debt>0
  ? 'Stability is a shared gift. Bring debt down before stretching the family budget.'
  : 'Your choices are becoming dependable. Protect the people and goals that matter most.';
}
