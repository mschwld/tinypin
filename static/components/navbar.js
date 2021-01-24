app.addSetter('navbar.toggleMenu', (data) => {
    data.menuOpen = !data.menuOpen;
});

app.addSetter('navbar.closeMenu', (data) => {
    data.menuOpen = false;
});

app.addSetter('navbar.refresh', () =>{
    window.location.reload();
});

app.addSetter("navbar.logout", () => {
    window.location = "./logout";
});

app.addComponent('navbar', (store) => { return new Reef("#navbar", {
    store: store,
    template: (data) => {

        let boardName = "";

        if ( data.board ){
            boardName = /*html*/`
            <span class="navbar-item">
                <span>${data.board.name} &nbsp;</span>
                <a data-onclick="editBoardModal.open"><img style="margin-top: -4px;" alt="edit" width="16" height="16" src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjMDAwMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGRhdGEtbmFtZT0iTGF5ZXIgMSIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHg9IjBweCIgeT0iMHB4Ij48dGl0bGU+NTE8L3RpdGxlPjxwYXRoIGQ9Ik04NC44NTAxMiw1MFY4MS43NDUxMkExMy4yNzAxMiwxMy4yNzAxMiwwLDAsMSw3MS41OTUyNCw5NUgxOC4yNTQ5MUExMy4yNzAxMiwxMy4yNzAxMiwwLDAsMSw1LDgxLjc0NTEyVjI4LjQwNTI4QTEzLjI3MDEyLDEzLjI3MDEyLDAsMCwxLDE4LjI1NDkxLDE1LjE1MDRINTBhMi41LDIuNSwwLDAsMSwwLDVIMTguMjU0OTFBOC4yNjQyMyw4LjI2NDIzLDAsMCwwLDEwLDI4LjQwNTI4VjgxLjc0NTEyQTguMjY0MjQsOC4yNjQyNCwwLDAsMCwxOC4yNTQ5MSw5MEg3MS41OTUyNGE4LjI2NDIzLDguMjY0MjMsMCwwLDAsOC4yNTQ4OC04LjI1NDg5VjUwYTIuNSwyLjUsMCwwLDEsNSwwWk04OS4xNDg0Niw2LjIzNzkyYTQuMjI2NjEsNC4yMjY2MSwwLDAsMC01Ljk3NzI5LDBsLTMzLjk2MjksMzMuOTYzTDU5Ljc5OTE2LDUwLjc5MTc2bDMzLjk2Mjg5LTMzLjk2M2E0LjIyNjUzLDQuMjI2NTMsMCwwLDAsMC01Ljk3NzIzWk00My42MjM4LDU4LjMxMjg3bDEzLjAwOTQtNC4zNTUxNkw0Ni4wNDIyNiw0My4zNjY4M2wtNC4zNTUxLDEzLjAwOTRBMS41MzAwNSwxLjUzMDA1LDAsMCwwLDQzLjYyMzgsNTguMzEyODdaIj48L3BhdGg+PC9zdmc+" /></a>
            </span>`;
        } else if ( !data.hash.board ) {
            boardName = /*html*/`<span class="navbar-item">Boards</span>`;
        }

        // ios web clip needs a refresh button.  other browsers have one that's already accessible
        let refreshItem = '';
        if ( window.navigator.standalone ){
            refreshItem = /*html*/`
            <a class="navbar-item has-text-right is-hidden-desktop" data-onclick="navbar.refresh">
                <span>refresh</span>
                <img alt="refresh" style="width:24px;height:24px;" src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjMDAwMDAwIiB4bWxuczp4PSJodHRwOi8vbnMuYWRvYmUuY29tL0V4dGVuc2liaWxpdHkvMS4wLyIgeG1sbnM6aT0iaHR0cDovL25zLmFkb2JlLmNvbS9BZG9iZUlsbHVzdHJhdG9yLzEwLjAvIiB4bWxuczpncmFwaD0iaHR0cDovL25zLmFkb2JlLmNvbS9HcmFwaHMvMS4wLyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDY0IDY0IiBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCA2NCA2NCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PG1ldGFkYXRhPjxzZncgeG1sbnM9Imh0dHA6Ly9ucy5hZG9iZS5jb20vU2F2ZUZvcldlYi8xLjAvIj48c2xpY2VzPjwvc2xpY2VzPjxzbGljZVNvdXJjZUJvdW5kcyBoZWlnaHQ9IjE2Mzg0IiB3aWR0aD0iMTYzODkiIHg9Ii04MTY1IiB5PSItODE2MCIgYm90dG9tTGVmdE9yaWdpbj0idHJ1ZSI+PC9zbGljZVNvdXJjZUJvdW5kcz48L3Nmdz48L21ldGFkYXRhPjxnPjxwYXRoIGQ9Ik0zMiw2QzE3LjY2NCw2LDYsMTcuNjY0LDYsMzJjMCwxNC4zMzcsMTEuNjY0LDI2LDI2LDI2YzE0LjMzNywwLDI2LTExLjY2MywyNi0yNkM1OCwxNy42NjQsNDYuMzM3LDYsMzIsNnogTTMyLDQ4ICAgYy03LjcyLDAtMTQtNi4yOC0xNC0xNGMwLTcuNDU0LDUuODU5LTEzLjU0OCwxMy4yMTItMTMuOTZsLTAuNjI2LTAuNjI2Yy0wLjc4MS0wLjc4MS0wLjc4MS0yLjA0NywwLTIuODI4ICAgYzAuNzgtMC43ODEsMi4wNDctMC43ODEsMi44MjgsMGw0LDRjMC43ODEsMC43ODEsMC43ODEsMi4wNDcsMCwyLjgyOGwtNCw0QzMzLjAyMywyNy44MDUsMzIuNTEyLDI4LDMyLDI4ICAgcy0xLjAyNC0wLjE5NS0xLjQxNC0wLjU4NmMtMC43ODEtMC43ODEtMC43ODEtMi4wNDcsMC0yLjgyOGwwLjU0Mi0wLjU0MkMyNi4wMjEsMjQuNDg4LDIyLDI4Ljc4LDIyLDM0YzAsNS41MTQsNC40ODYsMTAsMTAsMTAgICBjNS41MTQsMCwxMC00LjQ4NiwxMC0xMGMwLTEuMTA0LDAuODk2LTIsMi0yczIsMC44OTYsMiwyQzQ2LDQxLjcyLDM5LjcyLDQ4LDMyLDQ4eiI+PC9wYXRoPjwvZz48L3N2Zz4=" />
            </a>
            `;
        }

        return /*html*/`
        <nav class="navbar is-light" role="navigation" aria-label="main navigation">
            <div class="navbar-brand">
                <a class="navbar-item" href="#">
                    <img alt="boards" style="width:24px; height: 24px;" src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjMDAwMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2OCA0OCIgeD0iMHB4IiB5PSIwcHgiPjxwYXRoIGZpbGw9IiMwMDAwMDAiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTcyLDgwNiBMMTA3LDgwNiBDMTA4LjEwNDU2OSw4MDYgMTA5LDgwNi44OTU0MzEgMTA5LDgwOCBMMTA5LDgzMiBDMTA5LDgzMy4xMDQ1NjkgMTA4LjEwNDU2OSw4MzQgMTA3LDgzNCBMNzIsODM0IEM3MC44OTU0MzA1LDgzNCA3MCw4MzMuMTA0NTY5IDcwLDgzMiBMNzAsODA4IEM3MCw4MDYuODk1NDMxIDcwLjg5NTQzMDUsODA2IDcyLDgwNiBaIE0xMTIsODIyIEwxMTIsODIyIEwxMTIsODA4IEMxMTIsODA1LjIzODU3NiAxMDkuNzYxNDI0LDgwMyAxMDcsODAzIEw5Niw4MDMgTDk2LDc4OCBDOTYsNzg2Ljg5NTQzMSA5Ni44OTU0MzA1LDc4NiA5OCw3ODYgTDEyMiw3ODYgQzEyMy4xMDQ1NjksNzg2IDEyNCw3ODYuODk1NDMxIDEyNCw3ODggTDEyNCw4MjAgQzEyNCw4MjEuMTA0NTY5IDEyMy4xMDQ1NjksODIyIDEyMiw4MjIgTDExMiw4MjIgWiBNODQsODAzIEw3Miw4MDMgQzY5LjIzODU3NjMsODAzIDY3LDgwNS4yMzg1NzYgNjcsODA4IEw2Nyw4MTcgTDU4LDgxNyBDNTYuODk1NDMwNSw4MTcgNTYsODE2LjEwNDU2OSA1Niw4MTUgTDU2LDc5MSBDNTYsNzg5Ljg5NTQzMSA1Ni44OTU0MzA1LDc4OSA1OCw3ODkgTDgyLDc4OSBDODMuMTA0NTY5NSw3ODkgODQsNzg5Ljg5NTQzMSA4NCw3OTEgTDg0LDgwMyBaIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtNTYgLTc4NikiPjwvcGF0aD48L3N2Zz4=" />
                </a>
                ${boardName}
                <span id="loader-mobile" class="navbar-item" style="position: relative; margin-left: auto;">
                    <div id="loader" class="button is-text ${data.loading ? 'is-loading' : ''}"></div>
                </span>

                <a role="button" class="navbar-burger ${data.menuOpen ? 'is-active' : ''}" aria-label="menu" aria-expanded="false" data-onclick="navbar.toggleMenu">
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                </a>

            </div>

            <div class="navbar-menu ${data.menuOpen ? 'is-active' : ''} ">
                <div class="navbar-end">
                    
                    <a class="navbar-item has-text-right" data-onclick="addPinModal.open">
                        <span>add pin</span>    
                        <img alt="add pin" style="width:24px;height:24px; margin-top:4px;" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' data-name='Layer 1' viewBox='0 0 100 125' x='0px' y='0px'%3E%3Ctitle%3EArtboard 164%3C/title%3E%3Cpath d='M56.77,3.11a4,4,0,1,0-5.66,5.66l5.17,5.17L37.23,33A23.32,23.32,0,0,0,9.42,36.8L7.11,39.11a4,4,0,0,0,0,5.66l21.3,21.29L3.23,91.23a4,4,0,0,0,5.66,5.66L34.06,71.72l21,21a4,4,0,0,0,5.66,0l2.31-2.31a23.34,23.34,0,0,0,3.81-27.82l19-19,5.17,5.18a4,4,0,0,0,5.66-5.66Zm1.16,81.16L15.61,42a15.37,15.37,0,0,1,21.19.51L57.42,63.08A15.39,15.39,0,0,1,57.93,84.27Zm4-28L43.59,37.94,61.94,19.59,80.28,37.94Z'/%3E%3C/svg%3E"/>
                    </a>                  

                    <a class="navbar-item has-text-right" data-onclick="aboutModal.open">
                        <span>about tinypin</span>
                        <img alt="about" style="width:24px;height:24px;" src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjMDAwMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGRhdGEtbmFtZT0iTGF5ZXIgMSIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHg9IjBweCIgeT0iMHB4Ij48dGl0bGU+QXJ0Ym9hcmQgNzwvdGl0bGU+PHJlY3QgeD0iNDciIHk9IjQ5IiB3aWR0aD0iNiIgaGVpZ2h0PSIxNSI+PC9yZWN0PjxjaXJjbGUgY3g9IjUwIiBjeT0iMzkiIHI9IjMiPjwvY2lyY2xlPjxwYXRoIGQ9Ik01MCwyMEEzMCwzMCwwLDAsMCwyMCw1MGEyNy44OCwyNy44OCwwLDAsMCwzLjM1LDEzLjc0bC0zLDguMjFhNiw2LDAsMCwwLDcuNjksNy42OWw4LjIxLTNBMjcuODgsMjcuODgsMCwwLDAsNTAsODBhMzAsMzAsMCwxLDAsMC02MFptMCw1NGEyMS4wOCwyMS4wOCwwLDAsMS0xMy00TDI2LDc0bDQtMTFhMjEuMDgsMjEuMDgsMCwwLDEtNC0xM0EyNCwyNCwwLDEsMSw1MCw3NFoiPjwvcGF0aD48L3N2Zz4=" />
                    </a>
                    
                    ${refreshItem}

                    <a class="navbar-item has-text-right" data-onclick="navbar.logout">
                        <span>sign out</span>
                        <img alt="sign out" width="32" height="32" src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjMDAwMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGRhdGEtbmFtZT0iTGF5ZXIgMSIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHg9IjBweCIgeT0iMHB4Ij48dGl0bGU+QXJ0Ym9hcmQgODQ8L3RpdGxlPjxnPjxwYXRoIGQ9Ik0yOCw4MkgzOFY3NEgyOGEyLDIsMCwwLDEtMi0yVjI4YTIsMiwwLDAsMSwyLTJIMzhWMThIMjhBMTAsMTAsMCwwLDAsMTgsMjhWNzJBMTAsMTAsMCwwLDAsMjgsODJaIj48L3BhdGg+PHBhdGggZD0iTTY2LDMyLjM0LDYwLjM0LDM4bDgsOEgzNHY4SDY4LjM0bC04LDhMNjYsNjcuNjYsODAuODMsNTIuODNhNCw0LDAsMCwwLDAtNS42NloiPjwvcGF0aD48L2c+PC9zdmc+" />
                    <a>

                </div>
            </div>
        </nav>
        `;

    }

}); });