import {describe,expect,it} from 'vitest';
import {defaultAllocation,processAllocation,totalAllocation,isValidAllocation,applyEffect,recalculateScores} from './financeEngine';
const state={cash:20000,savings:20000,emergencyFund:0,investments:0,debt:0,monthlyIncome:45000,essentialExpenses:20000,salaryMultiplier:1,skillFund:0};
const scores={wealth:20,security:20,lifestyle:20,growth:20,goals:0};
describe('financial engine',()=>{
 it('allocates the exact salary',()=>expect(totalAllocation(defaultAllocation(45000))).toBe(45000));
 it('processes salary without combining accounts',()=>{const a=defaultAllocation(45000),n=processAllocation(state,a);expect(n.savings).toBe(state.savings+a.savings);expect(n.emergencyFund).toBe(a.emergency);expect(n.investments).toBe(a.investments)});
 it('accepts partial allocation and keeps the remainder as cash',()=>{const a=defaultAllocation(45000);a.skills-=1500;expect(isValidAllocation(a,45000)).toBe(true);expect(processAllocation(state,a).cash).toBe(state.cash+a.lifestyle+1500);expect(isValidAllocation({...a,skills:a.skills+2000},45000)).toBe(false)});
 it('applies debt and delayed effects safely',()=>{const r=applyEffect(state,scores,{debt:12000,growth:8});expect(r.state.debt).toBe(12000);expect(r.scores.growth).toBe(28)});
 it('keeps normalized scores inside 0..100',()=>{const r=recalculateScores({...state,savings:900000},scores,50000,50000);Object.values(r).forEach(v=>expect(v).toBeGreaterThanOrEqual(0));Object.values(r).forEach(v=>expect(v).toBeLessThanOrEqual(100))});
});
