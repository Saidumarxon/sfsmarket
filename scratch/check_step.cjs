const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/User/.gemini/antigravity/brain/6207f268-b30b-448a-b4dd-dfd6856a3b16/.system_generated/logs/transcript_full.jsonl')
});

rl.on('line', (line) => {
  try {
    const d = JSON.parse(line);
    if (d.step_index === 2142 || d.step_index === 3352 || d.step_index === 3354) {
      console.log(`=== Step ${d.step_index} ===`);
      if (d.content) console.log(d.content.slice(0, 400));
      if (d.tool_calls) console.log(JSON.stringify(d.tool_calls));
    }
  } catch (_) {}
});
