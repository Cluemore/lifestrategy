import type {FinancialState,Goal,StrategyId,StrategyVector} from '../game/types';
import {AGENTS,type Agent} from './agents';
import {STRATEGIES,STRATEGY_IDS} from './strategies';
export type Outcome={human:StrategyId;agent:StrategyId;allocation:StrategyVector;humanPayoff:number;agentPayoff:number};
const norm=(v:StrategyVector)=>{const s=v.security+v.savings+v.growth+v.lifestyle;return {security:v.security/s,savings:v.savings/s,growth:v.growth/s,lifestyle:v.lifestyle/s}};
export function humanPreferences(history:StrategyVector[],goals:Goal[]):StrategyVector{
 const base=history.length?history.reduce((a,v)=>({security:a.security+v.security,savings:a.savings+v.savings,growth:a.growth+v.growth,lifestyle:a.lifestyle+v.lifestyle}),{security:0,savings:0,growth:0,lifestyle:0}):{security:.25,savings:.25,growth:.25,lifestyle:.25};
 const n=Math.max(history.length,1); const g={security:0,savings:0,growth:0,lifestyle:0};
 goals.forEach(x=>{if(x.category==='security')g.security+=.10;else if(x.category==='growth')g.growth+=.10;else if(x.category==='lifestyle')g.lifestyle+=.10;else g.savings+=.10});
 return norm({security:base.security/n+g.security,savings:base.savings/n+g.savings,growth:base.growth/n+g.growth,lifestyle:base.lifestyle/n+g.lifestyle});
}
export function adaptiveAgent(agent:Agent,state:FinancialState):Agent{
 const coverage=state.emergencyFund/Math.max(state.essentialExpenses,1); const w={...agent.weights};
 if(agent.id==='sam'&&coverage>=3){w.security-=.12;w.growth+=.08;w.lifestyle+=.04}
 if(agent.id==='gia'&&coverage>=2&&state.debt<state.monthlyIncome*.25){w.growth+=.10;w.security-=.05;w.savings-=.05}
 if(agent.id==='leo'&&coverage<1){w.lifestyle-=.12;w.security+=.12}
 if(agent.id==='maya'&&state.debt>0){w.security+=.10;w.lifestyle-=.05;w.growth-=.05}
 return {...agent,weights:norm(w)};
}
export const negotiate=(h:StrategyId,a:StrategyId):StrategyVector=>{const x=STRATEGIES[h].vector,y=STRATEGIES[a].vector;return {security:(x.security+y.security)/2,savings:(x.savings+y.savings)/2,growth:(x.growth+y.growth)/2,lifestyle:(x.lifestyle+y.lifestyle)/2}};
export function utility(x:StrategyVector,w:StrategyVector,state:FinancialState,debtSensitivity=.25,goalSensitivity=.2){
 const coverage=state.emergencyFund/Math.max(state.essentialExpenses,1); const marginal={security:1.35/(.55+coverage),savings:1/(.65+state.savings/Math.max(state.monthlyIncome,1)),growth:1.1/(.7+state.investments/Math.max(state.monthlyIncome*2,1)),lifestyle:1/(.8)};
 const benefit=(Object.keys(x) as (keyof StrategyVector)[]).reduce((s,k)=>s+w[k]*marginal[k]*Math.log1p(x[k]*8),0);
 const debtPenalty=state.debt/Math.max(state.monthlyIncome*6,1); return +(100*(benefit-debtSensitivity*debtPenalty+goalSensitivity*.08)).toFixed(1);
}
export function matrix(state:FinancialState,humanWeights:StrategyVector,rawAgent:Agent):Outcome[]{const agent=adaptiveAgent(rawAgent,state);return STRATEGY_IDS.flatMap(h=>STRATEGY_IDS.map(a=>{const allocation=negotiate(h,a);return {human:h,agent:a,allocation,humanPayoff:utility(allocation,humanWeights,state,.25,.25),agentPayoff:utility(allocation,agent.weights,state,agent.debtSensitivity,agent.goalSensitivity)}}));}
export function bestResponses(outcomes:Outcome[]){const human=new Set<string>(),agent=new Set<string>();STRATEGY_IDS.forEach(a=>{const col=outcomes.filter(o=>o.agent===a),m=Math.max(...col.map(o=>o.humanPayoff));col.filter(o=>o.humanPayoff===m).forEach(o=>human.add(`${o.human}|${o.agent}`))});STRATEGY_IDS.forEach(h=>{const row=outcomes.filter(o=>o.human===h),m=Math.max(...row.map(o=>o.agentPayoff));row.filter(o=>o.agentPayoff===m).forEach(o=>agent.add(`${o.human}|${o.agent}`))});return {human,agent};}
export function nashEquilibria(outcomes:Outcome[]){const b=bestResponses(outcomes);return outcomes.filter(o=>b.human.has(`${o.human}|${o.agent}`)&&b.agent.has(`${o.human}|${o.agent}`));}
export function paretoFrontier(outcomes:Outcome[]){return outcomes.filter(a=>!outcomes.some(b=>(b.humanPayoff>=a.humanPayoff&&b.agentPayoff>=a.agentPayoff)&&(b.humanPayoff>a.humanPayoff||b.agentPayoff>a.agentPayoff)));}
export const agentForMonth=(month:number)=>AGENTS.filter(a=>a.month<=month).at(-1)||AGENTS[0];
