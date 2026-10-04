import {describe,expect,it} from 'vitest';
import {AGENTS} from './agents';
import {STRATEGIES,STRATEGY_IDS} from './strategies';
import {bestResponses,matrix,nashEquilibria,negotiate,paretoFrontier,utility} from './engine';
const state={cash:20000,savings:20000,emergencyFund:5000,investments:2000,debt:0,monthlyIncome:45000,essentialExpenses:20000,salaryMultiplier:1,skillFund:0};
const weights={security:.3,savings:.3,growth:.25,lifestyle:.15};
describe('game theory engine',()=>{
 it('keeps every strategy vector normalized',()=>STRATEGY_IDS.forEach(id=>expect(Object.values(STRATEGIES[id].vector).reduce((a,b)=>a+b,0)).toBeCloseTo(1)));
 it('negotiates as an exact equal blend',()=>{const v=negotiate('SECURITY','GROWTH');expect(v.security).toBeCloseTo(.25);expect(v.savings).toBeCloseTo(.25);expect(v.growth).toBeCloseTo(.35);expect(v.lifestyle).toBeCloseTo(.15)});
 it('calculates all 16 payoffs from current state',()=>{const m=matrix(state,weights,AGENTS[0]);expect(m).toHaveLength(16);expect(new Set(m.map(x=>x.humanPayoff)).size).toBeGreaterThan(1)});
 it('supports tied best responses',()=>{const m=matrix(state,weights,AGENTS[0]);const b=bestResponses(m);expect(b.human.size).toBeGreaterThanOrEqual(4);expect(b.agent.size).toBeGreaterThanOrEqual(4)});
 it('finds only mutual best responses as Nash',()=>{const m=matrix(state,weights,AGENTS[0]);const b=bestResponses(m);nashEquilibria(m).forEach(o=>{expect(b.human.has(`${o.human}|${o.agent}`)).toBe(true);expect(b.agent.has(`${o.human}|${o.agent}`)).toBe(true)})});
 it('supports a no-Nash outcome set',()=>{const fake=STRATEGY_IDS.flatMap((h,hi)=>STRATEGY_IDS.map((a,ai)=>({human:h,agent:a,allocation:STRATEGIES[h].vector,humanPayoff:(hi-ai+4)%4,agentPayoff:(hi-ai+3)%4})));expect(nashEquilibria(fake)).toEqual([])});
 it('supports multiple equilibria',()=>{const fake=STRATEGY_IDS.flatMap((h,hi)=>STRATEGY_IDS.map((a,ai)=>({human:h,agent:a,allocation:STRATEGIES[h].vector,humanPayoff:hi===ai?10:0,agentPayoff:hi===ai?10:0})));expect(nashEquilibria(fake)).toHaveLength(4)});
 it('returns only undominated outcomes',()=>{const f=paretoFrontier(matrix(state,weights,AGENTS[1]));expect(f.length).toBeGreaterThan(0);f.forEach(a=>expect(f.some(b=>b!==a&&b.humanPayoff>=a.humanPayoff&&b.agentPayoff>=a.agentPayoff&&(b.humanPayoff>a.humanPayoff||b.agentPayoff>a.agentPayoff))).toBe(false))});
 it('uses state-dependent diminishing security value',()=>{const x=STRATEGIES.SECURITY.vector;const low=utility(x,weights,state);const rich=utility(x,weights,{...state,emergencyFund:100000});expect(low).toBeGreaterThan(rich)});
});
