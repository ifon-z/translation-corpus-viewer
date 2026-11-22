// Mirrors the downloadable sample files so file URLs can load examples without fetching.
const ViewerExamples = {
  "bga-style-demo.jsonl": [
    "{\"id\":\"orchard-demo-01\",\"context\":\"Setup\",\"source\":\"Place {gearCount} seed gears beside the orchard dial.\",\"target\":\"把 {gearCount} 枚种子齿轮放在果园转盘旁。\"}",
    "{\"id\":\"orchard-demo-02\",\"context\":\"Turn prompt\",\"source\":\"Pass the orchard key to the next keeper.\",\"target\":\"\"}",
    "{\"id\":\"orchard-demo-03\",\"context\":\"End of round\",\"source\":\"Ring the orchard bell at {bellTime}.\",\"target\":\"敲响果园铃。\"}",
    "{\"id\":\"orchard-demo-04\",\"context\":\"Rules reminder\",\"source\":\"Rotate the [green]seed bridge[/green] before opening the gate.\",\"target\":\"打开大门前，转动种子桥。\"}",
    "{\"id\":\"orchard-demo-05\",\"context\":\"Score summary\",\"source\":\"%1$s collected %2$d gear blossoms.\",\"target\":\"%1$s 收集了 %2$d 朵齿轮花。\"}",
    "{\"id\":\"orchard-demo-06\",\"context\":\"Tutorial\",\"source\":\"A seed gear can be used once per round.\",\"target\":\"每枚种子齿轮每轮可使用一次。\"}",
    "",
  ].join("\n"),
  "app-ui-demo.csv": [
    "id,context,source,target",
    "ui-demo-01,Navigation,Open a saved draft,打开已保存的草稿",
    "ui-demo-02,Storage,This workspace uses {used} of {limit} draft slots.,此工作区已使用 {used} / {limit} 个草稿位置。",
    "ui-demo-03,Export help,\"Choose \"\"Export\"\", then select a format.",
    "Keep the original for your records.\",\"选择“导出”，然后选择格式。",
    "请保留原始文件备查。\"",
    "ui-demo-04,Empty state,Start a draft from a blank page.,",
    "ui-demo-05,Confirmation,Your draft has been saved.,草稿已保存。",
    "",
  ].join("\n"),
  "multilingual-demo.jsonl": [
    "{\"id\":\"guide-demo-01\",\"context\":\"Trail notes\",\"source_locale\":\"es\",\"source\":\"Anota {count} destellos antes de bajar la colina.\",\"translations\":{\"en\":\"Record {count} flashes before heading down the hill.\",\"zh-CN\":\"下山前记下 {count} 次闪光。\",\"ar\":\"سجّل {count} ومضات قبل النزول من التل.\"}}",
    "{\"id\":\"guide-demo-02\",\"context\":\"Navigation\",\"source_locale\":\"es\",\"source\":\"Busca la puerta de niebla.\",\"translations\":{\"en\":\"Look for the mist gate.\",\"zh-CN\":\"寻找迷雾之门。\",\"ar\":\"\"}}",
    "{\"id\":\"guide-demo-03\",\"context\":\"Field equipment\",\"source_locale\":\"es\",\"source\":\"Guarda la brújula en el estuche de lona.\",\"translations\":{\"en\":\"Store the compass in the canvas case.\",\"zh-CN\":\"把指南针放回帆布盒。\",\"ar\":\"ضع البوصلة في الحافظة القماشية.\"}}",
    "",
  ].join("\n"),
}

if (typeof module === "object") module.exports = ViewerExamples
