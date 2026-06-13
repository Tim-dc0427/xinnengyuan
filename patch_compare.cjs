const fs = require('fs');
const file = 'e:/新能源/client/src/views/planning/CostAnalysis.vue';
let lines = fs.readFileSync(file, 'utf-8').split('\n');

// 1. Remove "加入对比" button — find and delete that line
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('addToCompare') && lines[i].includes('加入对比')) {
    lines.splice(i, 1);
    break;
  }
}

// 2. Remove "多方案对比" block — find from "多方案对比" comment to the closing </div> before next major section
let compareBlockStart = -1, compareBlockEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('多方案对比') && lines[i].includes('<!--')) {
    compareBlockStart = i;
  }
  if (compareBlockStart > 0 && compareBlockEnd < 0 && lines[i].includes('<!-- 投资构成：对比模式')) {
    compareBlockEnd = i;
    break;
  }
}
if (compareBlockStart > 0 && compareBlockEnd > compareBlockStart) {
  lines.splice(compareBlockStart, compareBlockEnd - compareBlockStart);
  console.log('Removed comparison block from calc tab');
}

// 3. Remove "投资构成：对比模式" v-if block — redundant since comparison is now only in compare tab
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('投资构成：对比模式 or 单方案模式') || (lines[i].includes('compareResults.length >= 2') && lines[i].includes('v-if'))) {
    // Find end of this block — it ends with the </div> before the single-plan else-if
    let j = i;
    let depth = 0;
    for (; j < lines.length; j++) {
      if (lines[j].includes('<div')) depth += (lines[j].match(/<div/g) || []).length;
      if (lines[j].includes('</div>')) depth -= (lines[j].match(/<\/div>/g) || []).length;
      if (depth <= 0 && j > i + 10) break;
    }
    // Replace with just the v-else-if single plan block
    // Actually let's just keep the single plan block and remove the v-if compare block above it
    // Find the v-else-if line
    let elseIfLine = -1;
    for (let k = i; k < j; k++) {
      if (lines[k].includes('v-else-if="investment"')) elseIfLine = k;
    }
    if (elseIfLine > 0) {
      // Remove from i to elseIfLine-1 (strip the compareResults v-if block)
      // Change v-else-if to v-if
      lines[elseIfLine] = lines[elseIfLine].replace('v-else-if="investment"', 'v-if="investment"');
      // Remove compareResults block lines
      let removeEnd = elseIfLine - 1;
      while (removeEnd >= i && !lines[removeEnd].trim().startsWith('</div>') && !lines[removeEnd].includes('<!--')) removeEnd--;
      lines.splice(i, removeEnd - i + 1);
      console.log('Simplified investment result display');
      break;
    }
  }
  if (i > 800) break; // safety
}

// 4. Remove compare state/functions from script
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// 传统电网对比') && lines[i].trim().startsWith('//')) {
    // Find end — up to the next non-empty non-comment line after the comment block
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === "async function runCalculation()") break;
    }
    lines.splice(i, j - i);
    console.log('Removed old compare state from script');
    break;
  }
}

// 5. Add filtered plan computed + update compare tab dropdowns
// Add filtered plans computed after loadPlans function
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('async function loadPlans()') && lines[i].includes('fetchPlans')) {
    // Insert after the closing brace of loadPlans
    let j = i;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === '}' && lines[j+1] && lines[j+1].trim() === '') break;
    }
    const filterCode = [
'',
'// 光伏/传统方案分类',
"const pvPlans = computed(() => plans.value.filter((p: any) => {",
"  const r = p.tech_route || p.techRoute || ''",
"  return ['centralized_pv', 'string_pv', 'pv_storage', 'distributed_pv'].includes(r)",
'}))',
"const tradPlans = computed(() => plans.value.filter((p: any) => {",
"  const r = p.tech_route || p.techRoute || ''",
"  return ['transmission', 'traditional_coal'].includes(r)",
'}))',
    ];
    lines.splice(j + 2, 0, ...filterCode);
    console.log('Added pvPlans/tradPlans computed');
    break;
  }
}

// 6. Update compare tab template — replace plan selectors with filtered versions
// Find the compare tab dropdowns and replace
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('方案A（光伏）') && lines[i].includes('comparePlanA')) {
    // Replace the planA selector block (3 lines: span + select)
    // The select is on next line
    let nextSelectLine = i + 1;
    // Replace the plans ref with pvPlans
    for (let k = i; k < i + 5; k++) {
      if (lines[k].includes('v-for="p in plans"') && lines[k].includes('comparePlanA')) {
        lines[k] = lines[k].replace('p in plans', 'p in pvPlans');
      }
    }
    // Find planB lines
    for (let k = i + 2; k < i + 8; k++) {
      if (lines[k].includes('方案B') && lines[k].includes('comparePlanB')) {
        // Update planB selector on next line
        for (let m = k; m < k + 3; m++) {
          if (lines[m].includes('v-for="p in plans"') && lines[m].includes('comparePlanB')) {
            lines[m] = lines[m].replace('p in plans', 'p in tradPlans');
          }
        }
      }
    }
    console.log('Updated compare tab dropdowns with filtered plans');
    break;
  }
}

fs.writeFileSync(file, lines.join('\n'), 'utf-8');
console.log('Done. Lines:', lines.length);
