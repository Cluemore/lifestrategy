import type {LifeEvent,EventChoice} from '../types';
const pay=(label:string,cost:number):EventChoice[]=>[
 {label:'Use emergency fund',hint:`Absorb ₹${cost.toLocaleString('en-IN')} safely`,effect:{emergencyFund:-cost,security:2}},
 {label:'Take from savings',hint:'A goal may take longer',effect:{savings:-cost,wealth:-2}},
 {label:'Borrow money',hint:'Protect cash now; repay later',effect:{debt:cost,security:-5}},
 {label:'Delay it',hint:'Keep money, accept some stress',effect:{lifestyle:-5,growth:-2}},
];
const opportunity=(label:string,cost:number,growth:number):EventChoice[]=>[
 {label:`Choose ${label}`,hint:`Pay ₹${cost.toLocaleString('en-IN')} now`,effect:{cash:-cost,growth},delayed:{dueIn:3,label:`${label} pays off`,effect:{monthlyIncome:2500,growth:8}}},
 {label:'Save for later',hint:'No cost and no upside',effect:{savings:1000,security:1}},
 {label:'Split the cost',hint:'Smaller step, smaller result',effect:{cash:-Math.round(cost/2),growth:Math.round(growth/2)}},
];
const positive=(amount:number):EventChoice[]=>[
 {label:'Save it',hint:'Strengthen future flexibility',effect:{savings:amount,wealth:4}},
 {label:'Invest it',hint:'Put the windfall to work',effect:{investments:amount,growth:4}},
 {label:'Enjoy some',hint:'Keep half, enjoy half',effect:{cash:Math.round(amount/2),lifestyle:5}},
];
const problems=[['Laptop repair','💻',12000],['Medical check-up','🩺',7000],['Rent increase','🏠',6000],['Phone replacement','📱',15000],['Travel emergency','🧳',9000],['Household repair','🔧',8000],['Dental visit','🦷',5500],['Lost wallet','👛',4500],['Family medicine','💊',6500],['Bike repair','🚲',3800],['Utility spike','💡',3200],['Work commute change','🚌',4200]] as const;
const opportunities=[['certification',6000,8],['weekend workshop',3500,5],['portfolio course',4200,6],['networking conference',5000,7],['freelance toolkit',7000,9],['language class',3800,6],['fitness membership',3200,4],['design course',4500,6],['professional exam',8000,10],['side-project tools',2800,5],['mentor programme',4000,7],['career fair trip',3000,5]] as const;
const positives=[['Performance bonus','⭐',8000],['Freelance payment','🧾',6500],['Festival gift','🎁',5000],['Investment return','📈',4200],['Tax refund','✉️',3600],['Project prize','🏆',10000],['Referral reward','🤝',4500],['Cashback surprise','🪙',2400],['Salary correction','💼',5200],['Travel refund','🎫',3900],['Book allowance','📚',2800],['Side-sale income','🛍️',3300]] as const;
export const EVENTS:LifeEvent[]=[
 ...problems.map((e,i)=>({id:`problem-${i}`,title:e[0],icon:e[1],story:`An unexpected ${e[0].toLowerCase()} needs attention. Your earlier choices shape the options now.`,type:'problem' as const,cost:e[2],choices:pay(e[0],e[2])})),
 ...opportunities.map((e,i)=>({id:`opportunity-${i}`,title:`A ${e[0]} opens`,icon:'✨',story:`A timely ${e[0]} could improve your future—but it competes with today's plans.`,type:'opportunity' as const,cost:e[1],choices:opportunity(e[0],e[1],e[2])})),
 ...positives.map((e,i)=>({id:`positive-${i}`,title:e[0],icon:e[1],story:`A welcome ₹${e[2].toLocaleString('en-IN')} arrives. Where should it go?`,type:'positive' as const,choices:positive(e[2])})),
];
