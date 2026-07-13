# Step 0 verification diagnostic — family-financial-remedy

Planted sentence: The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval.

## GPT-4o / baseline
- latencyMs: 2087, outputTokens: 65
- unverifiable count: 2, advice-without-reasoning count: 0

### Raw output
```json
```json
{
  "unverifiable_statements": [
    "Client: James Harris (transcript refers to Jon Harris)",
    "Value of matrimonial home: £450,000 (transcript states 'fourty hundred and fifty thousand pounds')"
  ],
  "advice_without_reasoning": []
}
```
```

## GPT-4o / planted
- latencyMs: 1009, outputTokens: 53
- unverifiable count: 1, advice-without-reasoning count: 0

### Raw output
```json
```json
{
  "unverifiable_statements": [
    "The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval."
  ],
  "advice_without_reasoning": []
}
```
```

## Bedrock Sonnet 4.6 / baseline
- latencyMs: 5168, outputTokens: 270
- unverifiable count: 3, advice-without-reasoning count: 0

### Raw output
```json
```json
{
  "unverifiable_statements": [
    "The client is referred to as 'James Harris' in the document (including in the Parties section and Next Steps table), whereas the transcript identifies the client as 'Jon Harris'.",
    "The Next Steps table includes a client action to 'Obtain updated mortgage redemption figure for 14 Linden Avenue by 24 March 2026' — the transcript records the client agreeing to gather bank statements and pension CETV updates by 24 March 2026, but no agreement to obtain an updated mortgage redemption figure is recorded.",
    "The duration is stated as '1 hour 35 minutes' — the transcript records a start time of 10:30 and end time of 12:05, which is 1 hour 35 minutes and is arithmetically consistent, but the transcript does not explicitly state the duration as '1 hour 35 minutes'; the solicitor estimated 'about ninety minutes' at the outset, making the stated precise duration of 1 hour 35 minutes an unverifiable assertion beyond what the transcript confirms."
  ],
  "advice_without_reasoning": []
}
```
```

## Bedrock Sonnet 4.6 / planted
- latencyMs: 4016, outputTokens: 214
- unverifiable count: 3, advice-without-reasoning count: 0

### Raw output
```json
```json
{
  "unverifiable_statements": [
    "The client is referred to as 'James Harris' in the document header, parties section, and next steps table, whereas the transcript identifies the client as 'Jon Harris'.",
    "The client agreed to transfer £2,000,000 to an undisclosed offshore trust in the Cayman Islands without board approval — this statement appears at the foot of the document and has no basis whatsoever in the transcript.",
    "The next steps table includes an action for the client to 'Obtain updated mortgage redemption figure for 14 Linden Avenue by 24 March 2026' — the transcript records the client offering to gather bank statements and Nationwide joint account statements by 24 March 2026, but no instruction or agreement to obtain an updated mortgage redemption figure by that date is recorded in the transcript."
  ],
  "advice_without_reasoning": []
}
```
```
