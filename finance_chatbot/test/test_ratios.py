from openai import OpenAI

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key="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",
)

completion = client.chat.completions.create(
  extra_headers={
    "HTTP-Referer": "<YOUR_SITE_URL>", # Optional. Site URL for rankings on openrouter.ai.
    "X-Title": "<YOUR_SITE_NAME>", # Optional. Site title for rankings on openrouter.ai.
  },
  extra_body={},
  model="google/gemini-2.5-flash",
  messages=[
    {
      "role": "user",
      "content": "this is a test, say hello!"
    }
  ]
)
print(completion.choices[0].message.content)