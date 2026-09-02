# WebChat Installation

## 1. Create the widget

1. Open the Bliv platform and navigate to **Configurações > WebChat**.
2. Click **Novo widget**.
3. Fill in:
   - **Título**: the header text shown in the widget.
   - **Mensagem de boas-vindas**: first message sent to the visitor.
   - **Placeholder**: placeholder text of the input field.
   - **Cor de destaque**: a hex color such as `#0ea5e9` or `#3b82f6`.
   - **Posição**: bottom-right or bottom-left.
   - **Avatar URL**: optional public image URL (`https://...`).
   - **Origens permitidas (allowed origins)**: the exact origins that may embed
     the widget, e.g. `https://empresa.com.br` and `https://www.empresa.com.br`.
     Leave empty during development; set in production.

4. Save. Copy the **Public ID** shown on the screen.

## 2. Copy the script

The widget is installed with a single async script tag:

```html
<script
  src="https://app.seudominio.com/api/public/webchat/{PUBLIC_ID}/widget/js"
  async
></script>
```

Replace `{PUBLIC_ID}` with the value from step 1.

Paste the tag right before the closing `</body>` tag of your website.

## 3. Verify

Open the page, click the chat bubble, send a message and confirm in the Bliv
Inbox that the conversation appears under the **WebChat** filter.

## 4. Configure allowed origins

For production, always set at least one allowed origin.

```
https://www.empresa.com.br
https://empresa.com.br
```

Wildcard origins (`*`) are not supported; use exact values. The check compares
`protocol + host` (including port if non-standard), so
`https://empresa.com.br:8080` is different from `https://empresa.com.br`.

## 5. Behavior

- Visitors remain anonymous until they send the first message.
- The first message creates a contact, a `contact_identity` and a
  `chat_session` automatically.
- Reloading the page restores the same session from `localStorage`.
- Messages can be answered by bot, human agents or both depending on the
  conversation bot settings.
- Outbound messages show real `sent`, `delivered` and `read` status in the
  Inbox once the visitor receives and sees them.

## 6. Restrictions

- `avatarUrl` must be an `http:` or `https:` URL.
- `accentColor` must be a hex color (`#rrggbb` or `#rgb`).
- If the widget is disabled or the session expires, the visitor must start a
  new conversation.
