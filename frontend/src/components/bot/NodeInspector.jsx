/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * NodeInspector — right-side form panel for the currently-selected node.
 *
 * The five "primary" node types have first-class forms (spec):
 * message_text · message_buttons · ask_question · condition · end_conversation
 *
 * Every other type falls through to a generic JSON-edit textarea so the
 * editor never blocks you on a node it doesn't know about. fills
 * in dedicated forms for the remaining types.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Wand2, Sparkles } from 'lucide-react';

import { getNodeMeta } from './nodeCatalog';
import VariableInserter from './VariableInserter';
import { aiPersonaAPI } from '../../services/api';
import toast from '../ui/toast';

export default function NodeInspector({ node, onChange, onDelete, variables = [] }) {
 if (!node) return <EmptyState />;
 const meta = getNodeMeta(node.data.type);
 const Icon = meta.icon;
 const data = node.data.data || {};

 function patch(p) {
 onChange({ ...node.data.data, ...p });
 }

 return (
 <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
 <header style={{
 display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
 borderBottom: '1px solid var(--border-subtle)',
 }}>
 <span style={{
 width: 30, height: 30, borderRadius: 'var(--radius-sm)',
 background: `${meta.color}22`, color: meta.color,
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 }}>
 <Icon size={16} strokeWidth={2.2} />
 </span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{meta.category}</div>
 <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.label}</div>
 </div>
 {node.data.type !== 'start' && (
 <button type="button" onClick={onDelete} aria-label="Delete node" style={iconBtn}>
 <Trash2 size={14} />
 </button>
)}
 </header>

 <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
 <Form type={node.data.type} data={data} patch={patch} variables={variables} />
 </div>
 </div>
);
}

function Form({ type, data, patch, variables }) {
 switch (type) {
 case 'start': return <Hint>Flow entry point — only one per flow. Connect this to the first action.</Hint>;
 case 'message_text': return <FormMessageText data={data} patch={patch} variables={variables} />;
 case 'message_image':
 case 'message_video':
 case 'message_document':
 return <FormMedia type={type} data={data} patch={patch} variables={variables} />;
 case 'message_template': return <FormTemplate data={data} patch={patch} variables={variables} />;
 case 'message_buttons': return <FormButtons data={data} patch={patch} variables={variables} />;
 case 'message_list': return <FormList data={data} patch={patch} variables={variables} />;
 case 'message_cta': return <FormCTA data={data} patch={patch} variables={variables} />;

 case 'ask_question':
 case 'ask_email':
 case 'ask_phone':
 case 'ask_number':
 case 'ask_location':
 case 'ask_attachment':
 return <FormAsk type={type} data={data} patch={patch} variables={variables} />;

 case 'condition': return <FormCondition data={data} patch={patch} variables={variables} />;
 case 'random_split': return <FormRandomSplit />;
 case 'set_variable': return <FormSetVariable data={data} patch={patch} variables={variables} />;
 case 'jump_to_flow': return <FormJumpToFlow data={data} patch={patch} />;
 case 'wait_delay': return <FormWaitDelay data={data} patch={patch} />;

 case 'tag_contact': return <FormTagContact data={data} patch={patch} variables={variables} />;
 case 'capture_lead': return <FormCaptureLead data={data} patch={patch} />;
 case 'webhook': return <FormWebhook data={data} patch={patch} variables={variables} />;
 case 'send_email': return <FormSendEmail data={data} patch={patch} variables={variables} />;

 case 'ai_chat': return <FormAIChat data={data} patch={patch} variables={variables} />;
 case 'human_handoff': return <FormHandoff data={data} patch={patch} variables={variables} />;

 case 'end_conversation': return <FormEnd data={data} patch={patch} variables={variables} />;
 default: return <FormGeneric data={data} patch={patch} />;
 }
}

// ─────────────────────────────────────────────────────────
// 1. message_text
// ─────────────────────────────────────────────────────────
function FormMessageText({ data, patch, variables }) {
 return (
 <>
 <Field label="Message">
 <VariableTextarea
 value={data.text || ''}
 onChange={(v) => patch({ text: v })}
 variables={variables}
 rows={5}
 placeholder="Hi {{contact.name|default:&quot;there&quot;}}!"
 />
 </Field>
 <WhatsAppPreview body={data.text} />
 </>
);
}

// ─────────────────────────────────────────────────────────
// 2. message_buttons
// ─────────────────────────────────────────────────────────
function FormButtons({ data, patch, variables }) {
 const buttons = data.buttons || [];
 function setBtn(i, p) {
 const next = [...buttons]; next[i] = { ...next[i], ...p }; patch({ buttons: next });
 }
 function add() {
 if (buttons.length >= 3) return;
 patch({ buttons: [...buttons, { id: `OPT_${buttons.length + 1}`, title: `Option ${buttons.length + 1}` }] });
 }
 function remove(i) { patch({ buttons: buttons.filter((_, idx) => idx !== i) }); }

 return (
 <>
 <Field label="Body">
 <VariableTextarea value={data.body || ''} onChange={(v) => patch({ body: v })}
 variables={variables} rows={3} />
 </Field>
 <Field label="Variable to store choice in">
 <input value={data.store_var || ''} onChange={(e) => patch({ store_var: e.target.value })}
 style={inputStyle} placeholder="choice" />
 </Field>
 <Field label={`Buttons (${buttons.length}/3)`}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
 {buttons.map((b, i) => (
 <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 30px', gap: 6 }}>
 <input value={b.id || ''} onChange={(e) => setBtn(i, { id: e.target.value })}
 style={inputStyle} placeholder="OPT_A" />
 <input value={b.title || ''} onChange={(e) => setBtn(i, { title: e.target.value })}
 style={inputStyle} placeholder="Option A" maxLength={20} />
 <button type="button" onClick={() => remove(i)} aria-label="Remove button" style={iconBtn}>
 <X size={13} />
 </button>
 </div>
))}
 {buttons.length < 3 && (
 <button type="button" onClick={add} style={btnGhost}>
 <Plus size={13} /> Add button
 </button>
)}
 </div>
 </Field>
 <WhatsAppPreview body={data.body} buttons={buttons.map(b => b.title)} />
 </>
);
}

// ─────────────────────────────────────────────────────────
// 3. ask_*
// ─────────────────────────────────────────────────────────
function FormAsk({ type, data, patch, variables }) {
 const isNumber = type === 'ask_number';
 return (
 <>
 <Field label="Question to send">
 <VariableTextarea value={data.question || ''} onChange={(v) => patch({ question: v })}
 variables={variables} rows={3} />
 </Field>
 <Field label="Variable to store answer in">
 <input value={data.store_var || ''} onChange={(e) => patch({ store_var: e.target.value })}
 style={inputStyle} placeholder={
 type === 'ask_email' ? 'email' :
 type === 'ask_phone' ? 'phone' :
 type === 'ask_number' ? 'amount' :
 type === 'ask_location' ? 'location' :
 type === 'ask_attachment' ? 'attachment' : 'answer'
 } />
 </Field>
 <Field label="Retry message if invalid">
 <input value={data.retry_message || ''} onChange={(e) => patch({ retry_message: e.target.value })}
 style={inputStyle} placeholder="Defaults to a sensible message per ask type" />
 </Field>
 {isNumber && (
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
 <Field label="Min (optional)">
 <input type="number" value={data.min ?? ''} onChange={(e) => patch({ min: e.target.value === '' ? null : Number(e.target.value) })}
 style={inputStyle} />
 </Field>
 <Field label="Max (optional)">
 <input type="number" value={data.max ?? ''} onChange={(e) => patch({ max: e.target.value === '' ? null : Number(e.target.value) })}
 style={inputStyle} />
 </Field>
 </div>
)}
 <WhatsAppPreview body={data.question} />
 </>
);
}

// ─────────────────────────────────────────────────────────
// 4. condition (compound AND/OR builder)
// ─────────────────────────────────────────────────────────
const OPS = ['==', '!=', '>', '<', '>=', '<=', 'contains', 'starts_with', 'ends_with', 'regex_match', 'is_empty', 'is_not_empty'];

function FormCondition({ data, patch }) {
 // Normalise existing data.condition to compound shape so the UI can edit it
 const incoming = data.condition || {};
 const isCompound = incoming.operator === 'and' || incoming.operator === 'or';
 const condition = isCompound
 ? incoming
 : { operator: 'and', rules: [_leafFrom(incoming)] };

 function setCondition(c) { patch({ condition: c }); }
 function setRule(i, p) {
 const rules = [...(condition.rules || [])];
 rules[i] = { ...rules[i], ...p };
 setCondition({ ...condition, rules });
 }
 function addRule() {
 setCondition({ ...condition, rules: [...(condition.rules || []), { left: '', op: '==', right: '' }] });
 }
 function removeRule(i) {
 const rules = (condition.rules || []).filter((_, idx) => idx !== i);
 setCondition({ ...condition, rules });
 }

 return (
 <>
 <Hint>
 Wire two outputs from this node:&nbsp;
 <strong style={{ color: 'var(--success)' }}>true</strong> &amp;&nbsp;
 <strong style={{ color: 'var(--danger)' }}>false</strong>.
 </Hint>
 <Field label="Match">
 <select value={condition.operator || 'and'}
 onChange={(e) => setCondition({ ...condition, operator: e.target.value })}
 style={inputStyle}>
 <option value="and">All conditions (AND)</option>
 <option value="or">Any condition (OR)</option>
 </select>
 </Field>
 {(condition.rules || []).map((r, i) => (
 <div key={i} style={ruleBox}>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 30px', gap: 4 }}>
 <input value={r.left || ''} onChange={(e) => setRule(i, { left: e.target.value })}
 style={inputStyle} placeholder="variable_name" />
 <select value={r.op || '=='} onChange={(e) => setRule(i, { op: e.target.value })}
 style={inputStyle}>
 {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
 </select>
 <button type="button" onClick={() => removeRule(i)} aria-label="Remove rule" style={iconBtn}>
 <X size={11} />
 </button>
 </div>
 {!['is_empty', 'is_not_empty'].includes(r.op || '==') && (
 <input value={r.right ?? ''} onChange={(e) => setRule(i, { right: e.target.value })}
 style={{ ...inputStyle, marginTop: 4 }} placeholder="Compare to…" />
)}
 </div>
))}
 <button type="button" onClick={addRule} style={btnGhost}>
 <Plus size={11} /> Add condition
 </button>
 </>
);
}

function _leafFrom(c) {
 return { left: c.left || '', op: c.op || '==', right: c.right ?? '' };
}

// ─────────────────────────────────────────────────────────
// 5. end_conversation
// ─────────────────────────────────────────────────────────
function FormEnd({ data, patch, variables }) {
 return (
 <>
 <Hint>Optionally send a final message before ending the bot run.</Hint>
 <Field label="Closing message (optional)">
 <VariableTextarea value={data.text || ''} onChange={(v) => patch({ text: v })}
 variables={variables} rows={3}
 placeholder="Thanks! Our team will reach out shortly." />
 </Field>
 {data.text && <WhatsAppPreview body={data.text} />}
 </>
);
}

// ─────────────────────────────────────────────────────────
// 6. message_image / message_video / message_document
// ─────────────────────────────────────────────────────────
function FormMedia({ type, data, patch, variables }) {
 return (
 <>
 <Field label={type === 'message_video' ? 'Video URL' : type === 'message_document' ? 'Document URL' : 'Image URL'}>
 <input value={data.url || ''} onChange={(e) => patch({ url: e.target.value })}
 style={inputStyle} placeholder="https://…" />
 </Field>
 {type === 'message_document' && (
 <Field label="Filename (shown to user)">
 <input value={data.filename || ''} onChange={(e) => patch({ filename: e.target.value })}
 style={inputStyle} placeholder="brochure.pdf" />
 </Field>
)}
 <Field label={type === 'message_document' ? 'Caption' : 'Caption (optional)'}>
 <VariableTextarea value={data.caption || ''} onChange={(v) => patch({ caption: v })}
 variables={variables} rows={2} />
 </Field>
 <Hint>Public URL or a Pinbot media_id. The 24-hour window applies — outside it, use a Send Template node instead.</Hint>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 7. message_template
// ─────────────────────────────────────────────────────────
function FormTemplate({ data, patch, variables }) {
 const components = Array.isArray(data.components) ? data.components : [];

 function setComponent(i, p) {
 const next = [...components]; next[i] = { ...next[i], ...p }; patch({ components: next });
 }
 function addBody() {
 patch({ components: [...components, { type: 'body', parameters: [{ type: 'text', text: '' }] }] });
 }
 function setBodyParam(i, j, text) {
 const next = [...components];
 const params = [...(next[i].parameters || [])];
 params[j] = { type: 'text', text };
 next[i] = { ...next[i], parameters: params };
 patch({ components: next });
 }

 return (
 <>
 <Field label="Template name (must be approved)">
 <input value={data.template_name || ''} onChange={(e) => patch({ template_name: e.target.value })}
 style={inputStyle} placeholder="welcome_offer_v2" />
 </Field>
 <Field label="Language">
 <input value={data.language || 'en_US'} onChange={(e) => patch({ language: e.target.value })}
 style={inputStyle} placeholder="en_US" />
 </Field>
 <Field label="Body parameters">
 {components.length === 0 && (
 <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
 No body parameters. Click "Add body parameter" if your template uses {'{{1}}'}, {'{{2}}'}, etc.
 </div>
)}
 {components.map((c, i) => c.type === 'body' && (
 <div key={i} style={{ marginBottom: 8 }}>
 {(c.parameters || []).map((p, j) => (
 <div key={j} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
 <span style={{ width: 32, fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center', textAlign: 'center' }}>
 {`{{${j + 1}}}`}
 </span>
 <input value={p.text || ''} onChange={(e) => setBodyParam(i, j, e.target.value)}
 style={inputStyle} placeholder="Variable or literal" />
 </div>
))}
 <button type="button" onClick={() => setComponent(i, { parameters: [...(c.parameters || []), { type: 'text', text: '' }] })}
 style={btnGhost}><Plus size={11} /> Add parameter</button>
 </div>
))}
 {!components.some((c) => c.type === 'body') && (
 <button type="button" onClick={addBody} style={btnGhost}>
 <Plus size={11} /> Add body parameter
 </button>
)}
 </Field>
 <Hint>Required when sending outside the 24-hour conversation window. The template must be pre-approved on Pinbot.</Hint>
 <div style={{ marginTop: 4 }}>
 <VariableInserter variables={variables} onPick={() => {}} />
 </div>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 8. message_list
// ─────────────────────────────────────────────────────────
function FormList({ data, patch, variables }) {
 const sections = data.sections || [];
 function setSection(i, p) {
 const next = [...sections]; next[i] = { ...next[i], ...p }; patch({ sections: next });
 }
 function addSection() {
 patch({ sections: [...sections, { title: 'Section', rows: [{ id: 'r1', title: 'Row 1' }] }] });
 }
 function removeSection(i) { patch({ sections: sections.filter((_, idx) => idx !== i) }); }
 function setRow(si, ri, p) {
 const next = [...sections];
 const rows = [...(next[si].rows || [])];
 rows[ri] = { ...rows[ri], ...p };
 next[si] = { ...next[si], rows };
 patch({ sections: next });
 }
 function addRow(si) {
 const next = [...sections];
 const rows = [...(next[si].rows || [])];
 rows.push({ id: `r${rows.length + 1}`, title: `Row ${rows.length + 1}` });
 next[si] = { ...next[si], rows };
 patch({ sections: next });
 }
 function removeRow(si, ri) {
 const next = [...sections];
 next[si] = { ...next[si], rows: (next[si].rows || []).filter((_, idx) => idx !== ri) };
 patch({ sections: next });
 }

 return (
 <>
 <Field label="Body">
 <VariableTextarea value={data.body || ''} onChange={(v) => patch({ body: v })}
 variables={variables} rows={3} />
 </Field>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
 <Field label="Button label">
 <input value={data.button_label || 'Choose'} onChange={(e) => patch({ button_label: e.target.value })}
 style={inputStyle} maxLength={20} />
 </Field>
 <Field label="Store choice in">
 <input value={data.store_var || ''} onChange={(e) => patch({ store_var: e.target.value })}
 style={inputStyle} placeholder="choice" />
 </Field>
 </div>
 <Field label="Sections">
 {sections.map((s, si) => (
 <div key={si} style={sectionBox}>
 <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
 <input value={s.title || ''} onChange={(e) => setSection(si, { title: e.target.value })}
 style={{ ...inputStyle, fontWeight: 600 }} placeholder="Section title" />
 <button type="button" onClick={() => removeSection(si)} aria-label="Remove section" style={iconBtn}>
 <X size={12} />
 </button>
 </div>
 {(s.rows || []).map((r, ri) => (
 <div key={ri} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 30px', gap: 4, marginBottom: 4 }}>
 <input value={r.id || ''} onChange={(e) => setRow(si, ri, { id: e.target.value })}
 style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }} placeholder="row_id" />
 <input value={r.title || ''} onChange={(e) => setRow(si, ri, { title: e.target.value })}
 style={inputStyle} maxLength={24} placeholder="Row title" />
 <button type="button" onClick={() => removeRow(si, ri)} aria-label="Remove row" style={iconBtn}>
 <X size={11} />
 </button>
 </div>
))}
 <button type="button" onClick={() => addRow(si)} style={btnGhost}>
 <Plus size={11} /> Add row
 </button>
 </div>
))}
 <button type="button" onClick={addSection} style={btnGhost}>
 <Plus size={11} /> Add section
 </button>
 </Field>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 9. message_cta
// ─────────────────────────────────────────────────────────
function FormCTA({ data, patch, variables }) {
 return (
 <>
 <Field label="Body">
 <VariableTextarea value={data.body || ''} onChange={(v) => patch({ body: v })}
 variables={variables} rows={3} />
 </Field>
 <Field label="URL">
 <input value={data.url || ''} onChange={(e) => patch({ url: e.target.value })}
 style={inputStyle} placeholder="https://yourbiz.com/learn" />
 </Field>
 <Field label="Button text">
 <input value={data.button_text || 'Open'} onChange={(e) => patch({ button_text: e.target.value })}
 style={inputStyle} maxLength={20} placeholder="Open" />
 </Field>
 <Field label="Template name (optional — required outside 24h)">
 <input value={data.template_name || ''} onChange={(e) => patch({ template_name: e.target.value })}
 style={inputStyle} placeholder="cta_url_template" />
 </Field>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 10. random_split
// ─────────────────────────────────────────────────────────
function FormRandomSplit() {
 return (
 <Hint>
 Wires multiple outgoing edges. Set a numeric <strong>weight</strong> on each
 edge (in the edge's data), or leave them all blank for equal probability.
 The engine picks one edge per run, weighted accordingly.
 </Hint>
);
}

// ─────────────────────────────────────────────────────────
// 11. set_variable
// ─────────────────────────────────────────────────────────
function FormSetVariable({ data, patch, variables }) {
 return (
 <>
 <Field label="Variable name">
 <input value={data.name || ''} onChange={(e) => patch({ name: e.target.value })}
 style={inputStyle} placeholder="utm_source" />
 </Field>
 <Field label="Value">
 <VariableTextarea value={data.value ?? ''} onChange={(v) => patch({ value: v })}
 variables={variables} rows={2}
 placeholder='Literal value or "{{first_name}} {{last_name}}"' />
 </Field>
 <Hint>Values can include {`{{var}}`} tokens — they're rendered against the live conversation state.</Hint>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 12. jump_to_flow
// ─────────────────────────────────────────────────────────
function FormJumpToFlow({ data, patch }) {
 const [flows, setFlows] = useState([]);
 useEffect(() => {
 import('../../services/api').then(({ botAPI }) => {
 botAPI.list({ active: '1' }).then((r) => {
 setFlows(r.data?.results || r.data || []);
 }).catch(() => setFlows([]));
 });
 }, []);
 return (
 <>
 <Field label="Target flow">
 <select value={data.target_flow_id || ''} onChange={(e) => patch({ target_flow_id: e.target.value ? Number(e.target.value) : null })}
 style={inputStyle}>
 <option value="">Pick a flow…</option>
 {flows.map((f) => (
 <option key={f.id} value={f.id}>{f.name} {f.is_active ? '· active' : ''}</option>
))}
 </select>
 </Field>
 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
 <input type="checkbox" checked={!!data.carry_variables} onChange={(e) => patch({ carry_variables: e.target.checked })} />
 Carry collected variables into the new flow
 </label>
 <Hint>This node ends the current conversation and starts the target flow with the same contact. Only active flows show up.</Hint>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 13. wait_delay
// ─────────────────────────────────────────────────────────
function FormWaitDelay({ data, patch }) {
 return (
 <>
 <Hint>The bot pauses for this duration before continuing. Reminder: outside a 24-hour window, the next message must use a template.</Hint>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
 <Field label="Hours">
 <input type="number" min={0} value={data.hours ?? 0}
 onChange={(e) => patch({ hours: Number(e.target.value || 0) })} style={inputStyle} />
 </Field>
 <Field label="Minutes">
 <input type="number" min={0} value={data.minutes ?? 0}
 onChange={(e) => patch({ minutes: Number(e.target.value || 0) })} style={inputStyle} />
 </Field>
 <Field label="Seconds">
 <input type="number" min={0} value={data.seconds ?? 0}
 onChange={(e) => patch({ seconds: Number(e.target.value || 0) })} style={inputStyle} />
 </Field>
 </div>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 14. tag_contact
// ─────────────────────────────────────────────────────────
function FormTagContact({ data, patch, variables }) {
 const tags = data.tags || [];
 const [draft, setDraft] = useState('');
 function add() {
 const v = draft.trim();
 if (!v) return;
 patch({ tags: [...tags, v] }); setDraft('');
 }
 function remove(i) { patch({ tags: tags.filter((_, idx) => idx !== i) }); }

 return (
 <>
 <Field label="Tags to apply">
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
 {tags.map((t, i) => (
 <span key={i} style={{
 display: 'inline-flex', alignItems: 'center', gap: 4,
 padding: '3px 4px 3px 10px',
 background: 'var(--brand-primary-soft)',
 color: 'var(--brand-primary-hover)',
 border: '1px solid var(--brand-primary-glow)',
 borderRadius: 'var(--radius-pill)',
 fontSize: 11, fontWeight: 500,
 }}>
 {t}
 <button type="button" onClick={() => remove(i)} aria-label={`Remove ${t}`} style={chipBtn}>
 <X size={10} />
 </button>
 </span>
))}
 </div>
 <div style={{ display: 'flex', gap: 4 }}>
 <input value={draft} onChange={(e) => setDraft(e.target.value)}
 onKeyDown={(e) => { if (e.key === 'Enter') { add(); e.preventDefault(); } }}
 style={inputStyle} placeholder="hot-lead, real-estate, …" />
 <button type="button" onClick={add} aria-label="Add tag" style={iconBtn}>
 <Plus size={12} />
 </button>
 </div>
 <div style={{ marginTop: 4 }}>
 <VariableInserter variables={variables} onPick={(v) => setDraft((d) => d ? `${d}{{${v}}}` : `{{${v}}}`)} />
 </div>
 </Field>
 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
 <input type="checkbox" checked={!!data.remove} onChange={(e) => patch({ remove: e.target.checked })} />
 Remove these tags instead of adding them
 </label>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 15. capture_lead
// ─────────────────────────────────────────────────────────
function FormCaptureLead({ data, patch }) {
 const fieldMap = data.field_map || {};
 const tags = data.tags || [];
 const [draftTag, setDraftTag] = useState('');
 const STANDARD = ['name', 'email', 'phone', 'interest', 'budget', 'location'];

 function setMap(key, varName) {
 patch({ field_map: { ...fieldMap, [key]: varName } });
 }

 return (
 <>
 <Hint>Persists the conversation as a Lead row. By default, variables matching a column name are mapped automatically. Override the mapping below if your variables are named differently.</Hint>
 <Field label="Field mapping (optional overrides)">
 {STANDARD.map((k) => (
 <div key={k} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6, marginBottom: 4 }}>
 <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>{k}</span>
 <input value={fieldMap[k] || ''} onChange={(e) => setMap(k, e.target.value)}
 style={inputStyle} placeholder={`Defaults to {{${k}}}`} />
 </div>
))}
 </Field>
 <Field label="Extra tags on the lead">
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
 {tags.map((t, i) => (
 <span key={i} style={{
 padding: '2px 8px',
 background: 'var(--surface-sunken)', color: 'var(--text-secondary)',
 border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-pill)',
 fontSize: 11,
 }}>{t}{' '}
 <button type="button" aria-label={`Remove ${t}`}
 onClick={() => patch({ tags: tags.filter((_, idx) => idx !== i) })}
 style={chipBtn}><X size={9} /></button>
 </span>
))}
 </div>
 <div style={{ display: 'flex', gap: 4 }}>
 <input value={draftTag} onChange={(e) => setDraftTag(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && draftTag.trim()) {
 patch({ tags: [...tags, draftTag.trim()] }); setDraftTag('');
 e.preventDefault();
 }
 }}
 style={inputStyle} placeholder="ctwa, real-estate" />
 </div>
 </Field>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 16. webhook
// ─────────────────────────────────────────────────────────
function FormWebhook({ data, patch, variables }) {
 return (
 <>
 <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6 }}>
 <Field label="Method">
 <select value={data.method || 'POST'} onChange={(e) => patch({ method: e.target.value })}
 style={inputStyle}>
 <option value="POST">POST</option>
 <option value="GET">GET</option>
 <option value="PUT">PUT</option>
 <option value="PATCH">PATCH</option>
 </select>
 </Field>
 <Field label="URL">
 <input value={data.url || ''} onChange={(e) => patch({ url: e.target.value })}
 style={inputStyle} placeholder="https://hooks.slack.com/…" />
 </Field>
 </div>
 <Field label="Headers (JSON)">
 <textarea
 value={JSON.stringify(data.headers || {}, null, 2)}
 onBlur={(e) => {
 try { patch({ headers: JSON.parse(e.target.value || '{}') }); } catch {}
 }}
 onChange={(e) => patch({ headers: data.headers })} /* keep textarea editable */
 rows={3}
 style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'vertical' }}
 />
 </Field>
 <Field label="Body template (rendered with {{vars}})">
 <VariableTextarea value={data.body_template || ''} onChange={(v) => patch({ body_template: v })}
 variables={variables} rows={4}
 placeholder='{"name":"{{name}}","budget":"{{budget}}"}' />
 </Field>
 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
 <input type="checkbox" checked={data.include_variables ?? true}
 onChange={(e) => patch({ include_variables: e.target.checked })} />
 Include all collected variables in the request body
 </label>
 <Hint>Wires both <strong>success</strong> and <strong>failure</strong> outgoing edges so you can branch on the response.</Hint>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 17. send_email
// ─────────────────────────────────────────────────────────
function FormSendEmail({ data, patch, variables }) {
 return (
 <>
 <Field label="To (comma-separated)">
 <input value={Array.isArray(data.to) ? data.to.join(', ') : (data.to || '')}
 onChange={(e) => patch({ to: e.target.value })}
 style={inputStyle} placeholder="agency@example.com, sales@example.com" />
 </Field>
 <Field label="Subject">
 <VariableTextarea value={data.subject || ''} onChange={(v) => patch({ subject: v })}
 variables={variables} rows={1}
 placeholder="New lead: {{name}}" />
 </Field>
 <Field label="Body (plain text)">
 <VariableTextarea value={data.body || ''} onChange={(v) => patch({ body: v })}
 variables={variables} rows={6} />
 </Field>
 <Hint>Outbound from <code>DEFAULT_FROM_EMAIL</code> unless you set <code>from_email</code> in raw JSON. Send goes through Django's mail backend.</Hint>
 </>
);
}

// ─────────────────────────────────────────────────────────
// 18. ai_chat
// ─────────────────────────────────────────────────────────
function FormAIChat({ data, patch, variables }) {
 const exitWords = (data.exit_keywords || []).join(', ');
 const [wizardOpen, setWizardOpen] = useState(false);
 return (
 <>
 <div style={{ marginBottom: 12 }}>
 <div style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 marginBottom: 4,
 }}>
 <label style={{
 fontSize: 11, fontWeight: 600,
 letterSpacing: '0.04em', textTransform: 'uppercase',
 color: 'var(--text-tertiary)',
 }}>Persona / system prompt</label>
 <button type="button" onClick={() => setWizardOpen(true)} style={{
 display: 'inline-flex', alignItems: 'center', gap: 3,
 padding: '2px 8px', fontSize: 10, fontWeight: 600,
 color: 'var(--brand-primary-hover)',
 background: 'var(--brand-primary-soft)',
 border: '1px solid var(--brand-primary-glow)',
 borderRadius: 'var(--radius-pill)',
 fontFamily: 'inherit', cursor: 'pointer',
 }}>
 <Wand2 size={10} /> Build with AI
 </button>
 </div>
 <VariableTextarea value={data.persona || ''} onChange={(v) => patch({ persona: v })}
 variables={variables} rows={5}
 placeholder="You are a friendly real-estate consultant for Acme Properties. Reply in under 60 words…" />
 </div>
 {wizardOpen && (
 <PersonaWizard
 onClose={() => setWizardOpen(false)}
 onApply={(persona) => { patch({ persona }); setWizardOpen(false); }}
 />
)}
 <Field label="Opening message (optional)">
 <VariableTextarea value={data.opening_message || ''} onChange={(v) => patch({ opening_message: v })}
 variables={variables} rows={2}
 placeholder="Sure — how can I help?" />
 </Field>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
 <Field label="Max turns before exit">
 <input type="number" min={1} max={50} value={data.max_turns ?? 12}
 onChange={(e) => patch({ max_turns: Math.max(1, Number(e.target.value || 12)) })}
 style={inputStyle} />
 </Field>
 <Field label="Max tokens / reply">
 <input type="number" min={32} max={1024} value={data.max_tokens ?? 256}
 onChange={(e) => patch({ max_tokens: Math.max(32, Number(e.target.value || 256)) })}
 style={inputStyle} />
 </Field>
 </div>
 <Field label="Exit keywords (comma-separated)">
 <input value={exitWords} onChange={(e) => patch({ exit_keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
 style={inputStyle} placeholder="stop, agent, human" />
 </Field>
 <Hint>Uses our fast tier by default — quick responses, low cost. The user can exit by typing any of the keywords above (defaults: stop, agent, human, staff).</Hint>
 </>
);
}

// ─────────────────────────────────────────────────────────
// Persona builder wizard — modal launched from FormAIChat
// ─────────────────────────────────────────────────────────
function PersonaWizard({ onClose, onApply }) {
 const [businessName, setBusinessName] = useState('');
 const [industry, setIndustry] = useState('');
 const [whatYouDo, setWhatYouDo] = useState('');
 const [tone, setTone] = useState('friendly, professional');
 const [noGo, setNoGo] = useState('');
 const [busy, setBusy] = useState(false);
 const [draft, setDraft] = useState('');

 async function go() {
 if (!businessName.trim()) {
 toast.error('Business name is required');
 return;
 }
 setBusy(true);
 try {
 const r = await aiPersonaAPI.build({
 business_name: businessName.trim(),
 industry: industry || undefined,
 what_you_do: whatYouDo || undefined,
 tone: tone || undefined,
 no_go_topics: noGo
 ? noGo.split(',').map((s) => s.trim()).filter(Boolean)
 : [],
 });
 setDraft(r.data?.persona || '');
 } catch (e) {
 toast.error(e?.response?.data?.error || 'Could not build persona');
 } finally { setBusy(false); }
 }

 return (
 <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
 position: 'fixed', inset: 0, zIndex: 1300,
 background: 'rgba(10,14,20,0.55)',
 display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
 }}>
 <div style={{
 width: '100%', maxWidth: 520,
 background: 'var(--surface-elevated)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)',
 display: 'flex', flexDirection: 'column', maxHeight: '90vh',
 }}>
 <header style={{
 display: 'flex', alignItems: 'center', gap: 8,
 padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
 }}>
 <Wand2 size={16} style={{ color: 'var(--brand-primary-hover)' }} />
 <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Persona builder</h2>
 <button type="button" onClick={onClose} aria-label="Close" style={{ ...iconBtn, marginLeft: 'auto' }}>
 <X size={14} />
 </button>
 </header>

 <div style={{ padding: '14px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
 {!draft ? (
 <>
 <Field label="Business name *">
 <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
 autoFocus placeholder="Acme Properties" style={inputStyle} />
 </Field>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
 <Field label="Industry">
 <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={inputStyle}>
 <option value="">—</option>
 <option value="real-estate">Real estate</option>
 <option value="healthcare">Healthcare</option>
 <option value="restaurant">Restaurant</option>
 <option value="fitness">Fitness / gym</option>
 <option value="ecommerce">E-commerce</option>
 <option value="education">Education</option>
 <option value="services">Services</option>
 </select>
 </Field>
 <Field label="Tone">
 <input value={tone} onChange={(e) => setTone(e.target.value)}
 placeholder="friendly, professional" style={inputStyle} />
 </Field>
 </div>
 <Field label="What does your business do?">
 <textarea value={whatYouDo} onChange={(e) => setWhatYouDo(e.target.value)}
 rows={2}
 placeholder="We sell luxury 2-3 BHK apartments in central Bangalore."
 style={{ ...inputStyle, resize: 'vertical' }} />
 </Field>
 <Field label="No-go topics (comma-separated)">
 <input value={noGo} onChange={(e) => setNoGo(e.target.value)}
 placeholder="legal advice, medical advice, competitor pricing"
 style={inputStyle} />
 </Field>
 <p style={{
 margin: 0, fontSize: 11, color: 'var(--text-tertiary)',
 lineHeight: 1.5,
 }}>
 Social Stats drafts a system prompt suited to your business. You can edit it before applying.
 </p>
 </>
) : (
 <>
 <div style={{
 fontSize: 11, fontWeight: 600,
 color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase',
 display: 'flex', alignItems: 'center', gap: 6,
 }}>
 <Sparkles size={11} style={{ color: 'var(--brand-primary-hover)' }} />
 Drafted persona
 </div>
 <textarea
 value={draft} onChange={(e) => setDraft(e.target.value)}
 rows={9}
 style={{ ...inputStyle, resize: 'vertical', fontSize: 13, lineHeight: 1.5 }}
 />
 <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
 Tweak it inline, then apply — or regenerate with different inputs.
 </p>
 </>
)}
 </div>

 <footer style={{
 padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
 background: 'var(--surface-card)',
 display: 'flex', gap: 8, justifyContent: 'flex-end',
 }}>
 {draft ? (
 <>
 <button type="button" onClick={() => setDraft('')} style={btnGhost}>
 Back
 </button>
 <button type="button" onClick={go} disabled={busy} style={btnGhost}>
 {busy ? 'Regenerating…' : 'Regenerate'}
 </button>
 <button type="button" onClick={() => onApply(draft)} disabled={!draft.trim()} style={btnPrimaryWiz}>
 Apply persona
 </button>
 </>
) : (
 <>
 <button type="button" onClick={onClose} style={btnGhost}>Cancel</button>
 <button type="button" onClick={go} disabled={busy} style={btnPrimaryWiz}>
 {busy ? 'Building…' : <><Wand2 size={12} /> Build persona</>}
 </button>
 </>
)}
 </footer>
 </div>
 </div>
);
}

const btnPrimaryWiz = {
 display: 'inline-flex', alignItems: 'center', gap: 6,
 padding: '7px 14px',
 background: 'var(--brand-primary)', color: '#fff',
 border: 'none', borderRadius: 'var(--radius-md)',
 fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
 cursor: 'pointer',
};

// ─────────────────────────────────────────────────────────
// 19. human_handoff
// ─────────────────────────────────────────────────────────
function FormHandoff({ data, patch, variables }) {
 return (
 <>
 <Field label="Final message to the user">
 <VariableTextarea value={data.message || ''} onChange={(v) => patch({ message: v })}
 variables={variables} rows={3}
 placeholder="Connecting you to a teammate — they'll reply shortly." />
 </Field>
 <Field label="Assign to user id (optional)">
 <input type="number" value={data.assignee_user_id ?? ''}
 onChange={(e) => patch({ assignee_user_id: e.target.value ? Number(e.target.value) : null })}
 style={inputStyle} placeholder="Leave blank for round-robin" />
 </Field>
 <Hint>This terminates the bot's run. The conversation status flips to <strong>handed_off</strong> and the chosen agent gets notified via the Stage-13 dispatcher.</Hint>
 </>
);
}

// ─────────────────────────────────────────────────────────
// Generic JSON editor for not-yet-implemented inspectors
// ─────────────────────────────────────────────────────────
function FormGeneric({ data, patch }) {
 const [text, setText] = useState(JSON.stringify(data, null, 2));
 const [err, setErr] = useState('');

 useEffect(() => { setText(JSON.stringify(data, null, 2)); }, [data]);

 function commit() {
 try {
 const parsed = JSON.parse(text || '{}');
 setErr('');
 patch(parsed);
 } catch (e) {
 setErr(String(e.message || e));
 }
 }
 return (
 <>
 <Hint>This node type's full inspector ships in. Edit raw JSON below — we save on focus-out.</Hint>
 <textarea
 value={text} onChange={(e) => setText(e.target.value)}
 onBlur={commit}
 rows={14}
 style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
 />
 {err && <div style={{ marginTop: 6, color: 'var(--danger)', fontSize: 12 }}>{err}</div>}
 </>
);
}

// ─────────────────────────────────────────────────────────
// Reusable small components
// ─────────────────────────────────────────────────────────
function Field({ label, children }) {
 return (
 <div style={{ marginBottom: 12 }}>
 <label style={{
 display: 'block', fontSize: 11, fontWeight: 600,
 letterSpacing: '0.04em', textTransform: 'uppercase',
 color: 'var(--text-tertiary)', marginBottom: 4,
 }}>{label}</label>
 {children}
 </div>
);
}

function Hint({ children }) {
 return (
 <p style={{
 margin: '0 0 14px', fontSize: 12, color: 'var(--text-tertiary)',
 lineHeight: 1.55, padding: 10,
 background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)',
 }}>{children}</p>
);
}

function VariableTextarea({ value, onChange, variables, rows = 3, placeholder }) {
 return (
 <div style={{ position: 'relative' }}>
 <textarea
 value={value} onChange={(e) => onChange(e.target.value)}
 rows={rows} placeholder={placeholder}
 style={{ ...inputStyle, resize: 'vertical' }}
 />
 <div style={{ marginTop: 4 }}>
 <VariableInserter variables={variables}
 onPick={(name) => onChange((value || '') + `{{${name}}}`)} />
 </div>
 </div>
);
}

function WhatsAppPreview({ body, buttons }) {
 if (!body) return null;
 return (
 <div style={{ marginTop: 8 }}>
 <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
 Preview
 </div>
 <div style={{
 padding: 10,
 background: '#dcf8c6', color: '#1f2c34',
 borderRadius: '8px 8px 8px 2px',
 maxWidth: 240,
 fontSize: 13, lineHeight: 1.45,
 whiteSpace: 'pre-wrap',
 }}>
 {body}
 {buttons && buttons.length > 0 && (
 <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 4 }}>
 {buttons.map((b, i) => (
 <div key={i} style={{
 padding: '6px 12px', textAlign: 'center', fontSize: 12, fontWeight: 500,
 background: '#fff', color: '#075e54',
 border: '1px solid rgba(0,0,0,0.06)', borderRadius: 4,
 }}>{b}</div>
))}
 </div>
)}
 </div>
 </div>
);
}

function EmptyState() {
 return (
 <div style={{ padding: 32, color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center' }}>
 Click a node to edit it.
 </div>
);
}

const inputStyle = {
 width: '100%', padding: '8px 10px',
 background: 'var(--surface-sunken)',
 border: '1px solid var(--border-default)',
 borderRadius: 'var(--radius-sm)',
 fontSize: 13, color: 'var(--text-primary)',
 outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

const iconBtn = {
 width: 28, height: 28, padding: 0,
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 background: 'transparent', color: 'var(--text-tertiary)',
 border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
 cursor: 'pointer',
};

const btnGhost = {
 display: 'inline-flex', alignItems: 'center', gap: 6,
 padding: '7px 10px',
 background: 'var(--surface-card)', color: 'var(--text-secondary)',
 border: '1px dashed var(--border-default)',
 borderRadius: 'var(--radius-sm)',
 fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

const sectionBox = {
 padding: 8, marginBottom: 8,
 background: 'var(--surface-sunken)',
 border: '1px solid var(--border-subtle)',
 borderRadius: 'var(--radius-sm)',
};

const ruleBox = {
 padding: 8, marginBottom: 8,
 background: 'var(--surface-sunken)',
 border: '1px solid var(--border-subtle)',
 borderRadius: 'var(--radius-sm)',
};

const chipBtn = {
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 width: 16, height: 16, padding: 0, marginLeft: 2,
 background: 'transparent', color: 'inherit',
 border: 'none', borderRadius: 8, cursor: 'pointer',
};
