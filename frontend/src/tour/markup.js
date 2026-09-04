/**
 * The product tour's markup, as one string.
 *
 * A .js module rather than an .html?raw import: Vite understands ?raw, and the
 * smoke harness does not -- it bundles with esbuild, which has no loader for
 * .html at all, and that run is what proves every page still renders. A string
 * in a module is understood by both, so the build and the test cannot drift.
 *
 * Ported from retrieva-preview_2 verbatim. It is inserted once and then owned
 * by the tour module rather than by React -- see ProductTour.jsx.
 */
export default `<section class="section tour" id="tour" aria-label="Interactive preview of the Retrieva workspace">
  <div class="tour-app" data-tour>
    <!-- Sidebar -->
    <aside class="tour-side" aria-label="Workspace sidebar">
      <div class="tour-side-head">
        <div class="tour-brand"><span class="tour-mark" aria-hidden="true"></span>Retrieva</div>
        <button class="tour-ib" type="button" aria-label="Search chats" title="Search chats"><svg aria-hidden="true"><use href="#i-search"></use></svg></button>
        <button class="tour-ib" type="button" data-collapse aria-label="Collapse sidebar" title="Collapse sidebar"><svg aria-hidden="true"><use href="#i-panel"></use></svg></button>
      </div>
      <button class="tour-new" type="button" data-new><svg aria-hidden="true"><use href="#i-plus"></use></svg> New chat</button>
      <div class="tour-scroll">
        <div class="tour-group">
          <div class="tour-group-row">
            <button class="tour-group-toggle" type="button" data-toggle aria-expanded="true" aria-controls="tour-g-docs">Documents <svg aria-hidden="true"><use href="#i-chev-d"></use></svg></button>
            <button class="tour-ib" type="button" aria-label="Upload a document" title="Upload a document"><svg aria-hidden="true"><use href="#i-plus"></use></svg></button>
          </div>
          <div class="tour-group-body" id="tour-g-docs"><div data-docs></div></div>
        </div>
        <div class="tour-group">
          <div class="tour-group-row">
            <button class="tour-group-toggle" type="button" data-toggle aria-expanded="true" aria-controls="tour-g-projects">Projects <svg aria-hidden="true"><use href="#i-chev-d"></use></svg></button>
            <button class="tour-ib" type="button" aria-label="New project" title="New project"><svg aria-hidden="true"><use href="#i-plus"></use></svg></button>
          </div>
          <div class="tour-group-body" id="tour-g-projects"><div><button class="tour-item" type="button"><svg aria-hidden="true"><use href="#i-book"></use></svg><span>Policies 2025</span></button></div></div>
        </div>
        <div class="tour-group">
          <div class="tour-group-row">
            <button class="tour-group-toggle" type="button" data-toggle aria-expanded="true" aria-controls="tour-g-chats">Chats <svg aria-hidden="true"><use href="#i-chev-d"></use></svg></button>
          </div>
          <div class="tour-group-body" id="tour-g-chats"><div data-chats></div></div>
        </div>
      </div>
      <div class="tour-user">
        <span class="tour-avatar" aria-hidden="true">MI</span>
        <div><b>Maya Iyer</b><small>maya@example.com</small></div>
        <button class="tour-ib" type="button" aria-label="Account menu" title="Account menu"><svg aria-hidden="true"><use href="#i-more"></use></svg></button>
      </div>
    </aside>

    <!-- Chat -->
    <div class="tour-main">
      <div class="tour-bar">
        <button class="tour-ib tour-expand" type="button" data-expand aria-label="Show sidebar" title="Show sidebar"><svg aria-hidden="true"><use href="#i-panel"></use></svg></button>
        <h3><span data-title>New chat</span><svg aria-hidden="true" data-title-chev><use href="#i-chev-d"></use></svg></h3>
        <button class="tour-ib tour-ghost" type="button" data-private aria-label="Private chat" title="Private chat"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><g class="eyes"><path d="M6.99951 8.66672C7.5518 8.66672 7.99951 9.11443 7.99951 9.66672C7.9993 10.2188 7.55166 10.6667 6.99951 10.6667C6.44736 10.6667 5.99973 10.2188 5.99951 9.66672C5.99951 9.11443 6.44723 8.66672 6.99951 8.66672Z"></path><path d="M12.9995 8.66672C13.5518 8.66672 13.9995 9.11443 13.9995 9.66672C13.9993 10.2188 13.5517 10.6667 12.9995 10.6667C12.4474 10.6667 11.9997 10.2188 11.9995 9.66672C11.9995 9.11443 12.4472 8.66672 12.9995 8.66672Z"></path></g><path fill-rule="evenodd" clip-rule="evenodd" d="M10 2C14.326 2.00018 17.9998 5.67403 18 10V17.3123C17.9997 17.5427 17.8411 17.8079 17.6172 17.8623C17.3932 17.9165 17.1614 17.7456 17.0557 17.5408C16.7805 17.007 16.3658 16.5937 16.062 16.2878C15.7793 16.0034 15.4503 15.8338 14.9771 15.8337C14.2092 15.8339 13.4371 16.3862 12.9487 17.53C12.8701 17.7138 12.6887 17.8621 12.4888 17.8623C12.2888 17.8623 12.1076 17.7138 12.0288 17.53C11.5404 16.386 10.7674 15.8339 9.99951 15.8337C9.23161 15.8339 8.45959 16.386 7.97119 17.53C7.89253 17.7138 7.71118 17.8621 7.51123 17.8623C7.31122 17.8623 7.13006 17.7138 7.05127 17.53C6.56296 16.3862 5.78982 15.834 5.02197 15.8337C4.54861 15.8338 4.21974 16.0032 3.93701 16.2878C3.63309 16.5937 3.21952 17.0715 2.94434 17.6055C2.83865 17.8103 2.60589 17.9165 2.38184 17.8623C2.15801 17.8079 2.00033 17.6073 2 17.377V10C2.00018 5.67403 5.67403 2.00018 10 2ZM10 3C6.22631 3.00018 3.00018 6.22631 3 10V15.8633C3.0205 15.8414 3.20696 15.6049 3.22803 15.5837C3.67524 15.1336 4.251 14.8338 5.02197 14.8337C6.03838 14.8341 6.90232 15.4025 7.51025 16.2937C8.11828 15.4018 8.9824 14.8338 9.99951 14.8337C11.0163 14.8338 11.8798 15.4022 12.4878 16.2937C13.0959 15.4018 13.9601 14.8339 14.9771 14.8337C15.7481 14.8338 16.3247 15.1336 16.772 15.5837C16.772 15.5837 16.9796 15.812 17 15.8337V10C16.9998 6.22631 13.7737 3.00018 10 3Z"></path></svg></button>
      </div>
      <div class="tour-tabs" data-tabs aria-label="Chats"></div>
      <div class="tour-thread" data-thread></div>
      <div class="tour-composer" data-composer>
        <textarea rows="1" aria-label="Ask your knowledge base" placeholder="Ask your knowledge base" data-input></textarea>
        <div class="tour-comp-row">
          <button class="tour-ib" type="button" aria-label="Add a document" title="Add a document"><svg aria-hidden="true"><use href="#i-plus"></use></svg></button>
          <button class="tour-chip" type="button" data-scope aria-haspopup="true" aria-expanded="false"><svg aria-hidden="true"><use href="#i-target"></use></svg><span data-scope-label>All documents</span></button>
          <span class="grow"></span>
          <button class="tour-chip" type="button" data-model aria-haspopup="true" aria-expanded="false"><span data-model-label>GPT-4o</span></button>
          <button class="tour-ib" type="button" aria-label="Dictate" title="Dictate"><svg aria-hidden="true"><use href="#i-mic"></use></svg></button>
          <button class="tour-send" type="button" data-send aria-label="Send"><svg aria-hidden="true"><use href="#i-send"></use></svg></button>
        </div>
        <div class="tour-pop is-left" data-pop="scope" hidden></div>
        <div class="tour-pop is-right" data-pop="model" hidden></div>
      </div>
      <div class="tour-try" data-try></div>
    </div>

    <!-- Private chat: opens over the workspace, nothing here is kept -->
    <div class="tour-private" data-private-layer aria-label="Private chat">
      <div class="tour-private-bar"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><g><path d="M6.99951 8.66672C7.5518 8.66672 7.99951 9.11443 7.99951 9.66672C7.9993 10.2188 7.55166 10.6667 6.99951 10.6667C6.44736 10.6667 5.99973 10.2188 5.99951 9.66672C5.99951 9.11443 6.44723 8.66672 6.99951 8.66672Z"></path><path d="M12.9995 8.66672C13.5518 8.66672 13.9995 9.11443 13.9995 9.66672C13.9993 10.2188 13.5517 10.6667 12.9995 10.6667C12.4474 10.6667 11.9997 10.2188 11.9995 9.66672C11.9995 9.11443 12.4472 8.66672 12.9995 8.66672Z"></path></g><path fill-rule="evenodd" clip-rule="evenodd" d="M10 2C14.326 2.00018 17.9998 5.67403 18 10V17.3123C17.9997 17.5427 17.8411 17.8079 17.6172 17.8623C17.3932 17.9165 17.1614 17.7456 17.0557 17.5408C16.7805 17.007 16.3658 16.5937 16.062 16.2878C15.7793 16.0034 15.4503 15.8338 14.9771 15.8337C14.2092 15.8339 13.4371 16.3862 12.9487 17.53C12.8701 17.7138 12.6887 17.8621 12.4888 17.8623C12.2888 17.8623 12.1076 17.7138 12.0288 17.53C11.5404 16.386 10.7674 15.8339 9.99951 15.8337C9.23161 15.8339 8.45959 16.386 7.97119 17.53C7.89253 17.7138 7.71118 17.8621 7.51123 17.8623C7.31122 17.8623 7.13006 17.7138 7.05127 17.53C6.56296 16.3862 5.78982 15.834 5.02197 15.8337C4.54861 15.8338 4.21974 16.0032 3.93701 16.2878C3.63309 16.5937 3.21952 17.0715 2.94434 17.6055C2.83865 17.8103 2.60589 17.9165 2.38184 17.8623C2.15801 17.8079 2.00033 17.6073 2 17.377V10C2.00018 5.67403 5.67403 2.00018 10 2ZM10 3C6.22631 3.00018 3.00018 6.22631 3 10V15.8633C3.0205 15.8414 3.20696 15.6049 3.22803 15.5837C3.67524 15.1336 4.251 14.8338 5.02197 14.8337C6.03838 14.8341 6.90232 15.4025 7.51025 16.2937C8.11828 15.4018 8.9824 14.8338 9.99951 14.8337C11.0163 14.8338 11.8798 15.4022 12.4878 16.2937C13.0959 15.4018 13.9601 14.8339 14.9771 14.8337C15.7481 14.8338 16.3247 15.1336 16.772 15.5837C16.772 15.5837 16.9796 15.812 17 15.8337V10C16.9998 6.22631 13.7737 3.00018 10 3Z"></path></svg> Private chat
        <button class="tour-ib" type="button" data-private-close aria-label="Leave private chat" title="Leave private chat"><svg aria-hidden="true"><use href="#i-x"></use></svg></button>
      </div>
      <div class="tour-private-panel" data-private-panel>
        <div class="tour-thread" data-thread></div>
      <div class="tour-composer is-private" data-composer>
        <textarea rows="1" aria-label="Ask your knowledge base" placeholder="Ask your knowledge base" data-input></textarea>
        <div class="tour-comp-row">
          <button class="tour-ib" type="button" aria-label="Add a document" title="Add a document"><svg aria-hidden="true"><use href="#i-plus"></use></svg></button>
          <button class="tour-chip" type="button" data-scope aria-haspopup="true" aria-expanded="false"><svg aria-hidden="true"><use href="#i-target"></use></svg><span data-scope-label>All documents</span></button>
          <span class="grow"></span>
          <button class="tour-chip" type="button" data-model aria-haspopup="true" aria-expanded="false"><span data-model-label>GPT-4o</span></button>
          <button class="tour-ib" type="button" aria-label="Dictate" title="Dictate"><svg aria-hidden="true"><use href="#i-mic"></use></svg></button>
          <button class="tour-send" type="button" data-send aria-label="Send"><svg aria-hidden="true"><use href="#i-send"></use></svg></button>
        </div>
        <div class="tour-pop is-left" data-pop="scope" hidden></div>
        <div class="tour-pop is-right" data-pop="model" hidden></div>
      </div>
      <div class="tour-try" data-try></div>
      </div>
    </div>
  </div>
</section>
`;
