import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState } from "preact/hooks";


export default function AddTeamMember({ inviteUrl, companyId, companyLocationId, OnCreateMember }) {

  const [inviteFirst, setInviteFirst] = useState("");
  const [inviteLast, setInviteLast] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [invitePermission, setInvitePermission] = useState("Location admin");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");

  const doInviteSubmit = async () => {
    setInviteMessage("");
    setInviteError("");
    if (!inviteFirst.trim() || !inviteLast.trim() || !inviteEmail.trim()) {
      setInviteError("First name, last name and email are required.");
      return;
    }

    if (!companyId || !companyLocationId) {
      setInviteError("Company or location not available yet. Please wait and try again.");
      return;
    }

    setInviteLoading(true);
    try {
      const token = await shopify.sessionToken.get();

      const payload = {
        companyId: companyId,                // runtime company GID
        companyLocationId: companyLocationId, // runtime location GID
        contact: {
          firstName: inviteFirst.trim(),
          lastName: inviteLast.trim(),
          email: inviteEmail.trim(),
          title: inviteTitle || undefined,
        },
        permissions: [invitePermission], // server will map to role ids
      };

      const resp = await fetch(inviteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payload }),
        mode: "cors",
      });

      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        setInviteError(json?.message || `Server error ${resp.status}`);
        return;
      }

      if (json?.success) {
        OnCreateMember(json.companyContact.customer.id);
        //console.log("team member response",json.companyContact.customer.id);

        setInviteMessage("Team member invited successfully.");
        // refresh locations/team list

        // reset and close
        setTimeout(() => {
          setInviteFirst(""); setInviteLast(""); setInviteEmail(""); setInviteTitle("");
          setInvitePermission("Location admin");
          setInviteMessage("");
          //ui.overlay.close('my-modal');
        }, 1000);
      } else {
        setInviteError(json?.message || "Failed to invite team member.");
      }
    } catch (err) {
      console.error("Invite error:", err);
      setInviteError(String(err));
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <s-stack direction='inline' gap="base">
      <s-button command="--show" commandFor="modal-1"> Add Team Member </s-button>

      <s-modal id="modal-1" heading="Manage Team Member">
        <s-stack gap="base">
        {inviteError && <s-banner tone="critical"><s-text>{inviteError}</s-text></s-banner>}
        {inviteMessage && <s-banner tone="success"><s-text>{inviteMessage}</s-text></s-banner>}
          <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">
            <s-grid-item gridColumn="span 6" gridRow="span 1">
              <s-text-field label="First name *" value={inviteFirst} required
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setInviteFirst(val);
                }} />
            </s-grid-item>
            <s-grid-item gridColumn="span 6" gridRow="span 1">
              <s-text-field label="Last name *" value={inviteLast}
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setInviteLast(val);
                }} />
            </s-grid-item>

            <s-grid-item gridColumn="span 12" gridRow="span 1">
              <s-text-field label="Title" value={inviteTitle}
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setInviteTitle(val);
                }} />
            </s-grid-item>
            <s-grid-item gridColumn="span 12" gridRow="span 1">
              <s-text-field label="Email *" value={inviteEmail}
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setInviteEmail(val);
                }}
              />
            </s-grid-item>
            <s-grid-item gridColumn="span 12" gridRow="span 1">
              <s-select label="Permissions" value={invitePermission}
                onChange={(v) => {
                  const val = /** @type {HTMLInputElement} */ (v.target).value;
                  setInvitePermission(val);
                }}>
                <s-option value="Location admin">Location admin</s-option>
                <s-option value="Ordering only">Ordering only</s-option>
              </s-select>
            </s-grid-item>
            <s-grid-item gridColumn="span 4" gridRow="span 1">
              <s-stack gap="base">
                <s-button onClick={doInviteSubmit} loading={inviteLoading} disabled={inviteLoading} >
                  Send invite
                </s-button>
              </s-stack>
            </s-grid-item>
          </s-grid>
        </s-stack>
      </s-modal>
    </s-stack>
  )
}