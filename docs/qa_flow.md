

ok, so if i'm designing a general MCP tool that allows the following interface

# assistant flow

step 1.
assistant registers a new qa artifact id by calling the mcp tool qa_register

step 2.
assistant creates an artifact based on a given template 
inside the artifact, he fills in multi choice questions in the same format as the schema of AskUserQuestions
he also fills in the id he got from step two

step 3.
calls the wait_for_user_answer with the id



# user flow
step 1. asks UAUQ
step 2. is presented with an artifact that asks him questions
step 3. answers the multi choice questions and presses send.
step 4. claude responds to the answers

so in total he has 2 actions
1. requests UAUQ
2. answers questions and presses send


  "description": "Use this tool when you need to ask the user questions during execution. This allows you to:
  1. Gather user preferences or requirements
  2. Clarify ambiguous instructions
  3. Get decisions on implementation choices as you work
  4. Offer choices to the user about what direction to take.

  Usage notes:
  - Users will always be able to select \"Other\" to provide custom text input
  - Use multiSelect: true to allow multiple answers to be selected for a question
  - If you recommend a specific option, make that the first option in the list and add \"(Recommended)\" at the end of the label
  "

  And the parameters schema:

  {
    "properties": {
      "answers": {
        "additionalProperties": {"type": "string"},
        "description": "User answers collected by the permission component",
        "type": "object"
      },
      "questions": {
        "description": "Questions to ask the user (1-4 questions)",
        "items": {
          "properties": {
            "header": {
              "description": "Very short label displayed as a chip/tag (max 12 chars). Examples: \"Auth method\", \"Library\", \"Approach\".",
              "type": "string"
            },
            "multiSelect": {
              "description": "Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.",
              "type": "boolean"
            },
            "options": {
              "description": "The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.",
              "items": {
                "properties": {
                  "description": {
                    "description": "Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.",
                    "type": "string"
                  },
                  "label": {
                    "description": "The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.",
                    "type": "string"
                  }
                },
                "required": ["label", "description"]
              },
              "minItems": 2,
              "maxItems": 4
            },
            "question": {
              "description": "The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: \"Which library should we use for date formatting?\" If multiSelect is true, phrase it accordingly, e.g. \"Which features do you want to enable?\"",
              "type": "string"
            }
          },
          "required": ["question", "header", "options", "multiSelect"]
        },
        "minItems": 1,
        "maxItems": 4
      }
    },
    "required": ["questions"]
  }
