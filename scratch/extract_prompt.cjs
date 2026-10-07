const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/User/.gemini/antigravity/brain/6207f268-b30b-448a-b4dd-dfd6856a3b16/.system_generated/logs/transcript_full.jsonl')
});

rl.on('line', (line) => {
  if (line.includes('"step_index":4236')) {
    try {
      const data = JSON.parse(line);
      fs.writeFileSync('scratch/phase3b_prompt.txt', data.content || '', 'utf8');
      console.log('Saved prompt length:', (data.content || '').length);
    } catch (e) {
      console.error(e);
    }
  }
});
