---
'agent-base': patch
---

Fix: use duck typing for agent detection in createSocket to prevent silent hang with non-http.Agent agents like tunnel-agent's TunnelingAgent
