import {describe,expect,it} from 'vitest';
import {EVENTS} from '../data/events';
import {defaultAllocation,processAllocation,recalculateScores} from './financeEngine';
describe('12-month lifecycle and presentation content',()=>{
 it('contains the requested 35–40 predefined events',()=>expect(EVENTS.length).toBe(36));
 it('contains immediate choices and delayed opportunity consequences',()=>{expect(EVENTS.every(e=>e.choices.length>=3)).toBe(true);expect(EVENTS.some(e=>e.choices.some(c=>c.delayed))).toBe(true)});
 it('can process a complete balanced financial year',()=>{let state={cash:20000,savings:20000,emergencyFund:0,investments:0,debt:0,monthlyIncome:45000,essentialExpenses:20000,salaryMultiplier:1,skillFund:0};let scores={wealth:28,security:18,lifestyle:38,growth:30,goals:0};for(let month=1;month<=12;month++){const allocation=defaultAllocation(state.monthlyIncome);state=processAllocation(state,allocation);scores=recalculateScores(state,scores,allocation.lifestyle,allocation.skills)}expect(state.savings).toBeGreaterThan(20000);expect(state.emergencyFund).toBeGreaterThan(0);expect(state.investments).toBeGreaterThan(0);Object.values(scores).forEach(v=>expect(v).toBeGreaterThanOrEqual(0))});
});
