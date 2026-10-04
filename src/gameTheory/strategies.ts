import type {StrategyId,StrategyVector} from '../game/types';
export const STRATEGIES:Record<StrategyId,{label:string;icon:string;color:string;vector:StrategyVector}>={
 SECURITY:{label:'Security',icon:'🛡️',color:'#45a990',vector:{security:.35,savings:.35,growth:.20,lifestyle:.10}},
 GROWTH:{label:'Growth',icon:'🌱',color:'#efad42',vector:{security:.15,savings:.15,growth:.50,lifestyle:.20}},
 LIFESTYLE:{label:'Lifestyle',icon:'🎈',color:'#ed7e9b',vector:{security:.10,savings:.10,growth:.15,lifestyle:.65}},
 BALANCED:{label:'Balanced',icon:'⚖️',color:'#6c8ed8',vector:{security:.25,savings:.25,growth:.25,lifestyle:.25}},
};
export const STRATEGY_IDS=Object.keys(STRATEGIES) as StrategyId[];
