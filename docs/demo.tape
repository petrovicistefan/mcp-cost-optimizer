Output docs/demo.gif

Require ttyd
Require ffmpeg

Set FontSize 14
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"

Type "# MCP Cost Optimizer - Analyze LLM Usage" Sleep 500ms Enter
Sleep 1s

Type "# Create sample usage data" Sleep 300ms Enter
Type 'cat > /tmp/usage.json << EOF' Enter
Type '{' Enter
Type '  "records": [' Enter
Type '    {"model": "gpt-4o", "inputTokens": 5000, "outputTokens": 1000},' Enter
Type '    {"model": "gpt-4o", "inputTokens": 3000, "outputTokens": 500},' Enter
Type '    {"model": "claude-sonnet-4.5", "inputTokens": 4000, "outputTokens": 800}' Enter
Type '  ],' Enter
Type '  "rates": {' Enter
Type '    "currency": "USD",' Enter
Type '    "models": {' Enter
Type '      "gpt-4o": {"inputPerMillion": 2.5, "outputPerMillion": 10.0},' Enter
Type '      "claude-sonnet-4.5": {"inputPerMillion": 3.0, "outputPerMillion": 15.0}' Enter
Type '    }' Enter
Type '  }' Enter
Type '}' Enter
Type 'EOF' Enter
Sleep 1s

Type "# Run cost analysis" Sleep 300ms Enter
Type 'echo "Analyzing usage and showing total cost..."' Sleep 500ms Enter
Sleep 500ms

Type 'node -e "' Enter
Type "const data = require('/tmp/usage.json');" Enter
Type "const cost = data.records.reduce((sum, r) => {" Enter
Type "  const rate = data.rates.models[r.model];" Enter
Type "  return sum + (r.inputTokens * rate.inputPerMillion / 1000000) + (r.outputTokens * rate.outputPerMillion / 1000000);" Enter
Type "}, 0);" Enter
Type 'console.log(`Total cost: $${cost.toFixed(4)} USD`);' Enter
Type 'console.log(`Models analyzed: ${Object.keys(data.rates.models).join(", ")}`);' Enter
Type '"' Enter

Sleep 2s

Type "# MCP tools: estimate_llm_cost, analyze_llm_usage, compare_llm_models" Sleep 300ms Enter
Sleep 3s
