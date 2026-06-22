const menuButton = document.querySelector("#menu-icon");
const menuIcon = menuButton.querySelector("i");
const navbar = document.querySelector(".navbar");
const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#pokesearch");
const suggestionsBox = document.querySelector("#suggestions");
const pokemonContainer = document.querySelector("#pokemonContainer");
const statusMessage = document.querySelector("#statusMessage");
const searchButton = document.querySelector("#searchButton");
const randomButton = document.querySelector("#randomButton");

const apiBase = "https://pokeapi.co/api/v2";
let pokemonNames = []; //for autocomplete
let visibleSuggestions = [];
let activeSuggestionIndex = -1;
let currentSpeciesUrl = "";

menuButton.addEventListener("click", () => {
    const isOpen = navbar.classList.toggle("active");
    menuIcon.classList.toggle("bx-menu", !isOpen);
    menuIcon.classList.toggle("bx-x", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
});

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = normalizePokemonQuery(searchInput.value);

    if (query) {
        hideSuggestions();
        getPokemon(query);
    }
});

randomButton.addEventListener("click", () => {
    const randomId = Math.floor(Math.random() * 1025) + 1;
    hideSuggestions();
    getPokemon(randomId, "random");
});

searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    renderSuggestions(query);
});

searchInput.addEventListener("keydown", (event) => {
    if (!visibleSuggestions.length) {
        return;
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSuggestion(1);
    }

    if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSuggestion(-1);
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
        event.preventDefault();
        chooseSuggestion(visibleSuggestions[activeSuggestionIndex]);
    }

    if (event.key === "Escape") {
        hideSuggestions();
    }
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-field")) {
        hideSuggestions();
    }
});

pokemonContainer.addEventListener("click", (event) => {
    const button = event.target.closest(".evolution-button");

    if (button && currentSpeciesUrl) {
        showEvolution(button);
    }
});

loadPokemonNames();

async function loadPokemonNames() {
    try {
        const response = await fetch(`${apiBase}/pokemon?limit=1302`);

        if (!response.ok) {
            throw new Error("Could not load Pokemon suggestions.");
        }

        const data = await response.json();
        pokemonNames = data.results.map((pokemon) => pokemon.name);
    } catch (error) {
        console.error(error);
    }
}

async function getPokemon(searchTerm, mode = "search") {
    setLoading(true, mode);

    try {
        const response = await fetch(`${apiBase}/pokemon/${normalizePokemonQuery(searchTerm)}`);

        if (!response.ok) {
            throw new Error("No Pokemon found. Check the spelling and try again.");
        }

        const data = await response.json();
        currentSpeciesUrl = data.species.url;
        searchInput.value = formatName(data.name);
        renderPokemon(data);
        setStatus(`${formatName(data.name)} is ready to explore.`);
    } catch (error) {
        currentSpeciesUrl = "";
        pokemonContainer.innerHTML = "";
        setStatus(error.message, true);
    } finally {
        setLoading(false, mode);
    }
}

function renderSuggestions(query) {
    activeSuggestionIndex = -1;

    if (query.length < 2 || !pokemonNames.length) {
        hideSuggestions();
        return;
    }

    visibleSuggestions = pokemonNames
        .filter((name) => name.includes(query))
        .slice(0, 7);

    if (!visibleSuggestions.length) {
        hideSuggestions();
        return;
    }

    suggestionsBox.innerHTML = visibleSuggestions
        .map((name, index) => {
            const displayName = formatName(name);
            const highlighted = highlightMatch(displayName, query);

            return `<button class="suggestion-option" id="suggestion-${index}" type="button" role="option" aria-selected="false" data-name="${name}">${highlighted}</button>`;
        })
        .join("");

    suggestionsBox.classList.add("active");
    searchInput.setAttribute("aria-expanded", "true");

    suggestionsBox.querySelectorAll(".suggestion-option").forEach((option) => {
        option.addEventListener("click", () => chooseSuggestion(option.dataset.name));
    });
}

function moveSuggestion(direction) {
    const options = [...suggestionsBox.querySelectorAll(".suggestion-option")];

    activeSuggestionIndex = (activeSuggestionIndex + direction + options.length) % options.length;

    options.forEach((option, index) => {
        const isActive = index === activeSuggestionIndex;
        option.classList.toggle("active", isActive);
        option.setAttribute("aria-selected", String(isActive));
    });

    searchInput.setAttribute("aria-activedescendant", `suggestion-${activeSuggestionIndex}`);
}

function chooseSuggestion(name) {
    searchInput.value = formatName(name);
    hideSuggestions();
    getPokemon(name);
}

function hideSuggestions() {
    visibleSuggestions = [];
    activeSuggestionIndex = -1;
    suggestionsBox.classList.remove("active");
    suggestionsBox.innerHTML = "";
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.setAttribute("aria-activedescendant", "");
}

function renderPokemon(pokemon) {
    const image = pokemon.sprites.other["official-artwork"].front_default || pokemon.sprites.front_default || "Assests/maxresdefault.jpg";
    const types = pokemon.types.map(({ type }) => type.name);
    const typeBadges = types
        .map((type) => `<span class="type-badge type-${type}">${formatName(type)}</span>`)
        .join("");

    pokemonContainer.innerHTML = `
        <article class="pokemon-card">
            <div class="pokemon-card-inner">
                <div class="pokemon-art">
                    <img src="${image}" alt="${formatName(pokemon.name)} artwork">
                </div>
                <div class="pokemon-details">
                    <span class="pokemon-number">#${String(pokemon.id).padStart(3, "0")}</span>
                    <h2>${formatName(pokemon.name)}</h2>
                    <div class="type-list" aria-label="Pokemon types">${typeBadges}</div>
                    <div class="stats">
                        <div class="stat">
                            <span>Height</span>
                            <strong>${pokemon.height / 10}m</strong>
                        </div>
                        <div class="stat">
                            <span>Weight</span>
                            <strong>${pokemon.weight / 10}kg</strong>
                        </div>
                    </div>
                    <button class="evolution-button" type="button">Evolution Chain -></button>
                    <div class="evolution-list" id="evolutionList" aria-live="polite"></div>
                </div>    
            </div>
        </article>
    `;
}

async function showEvolution(button) {
    const evolutionList = document.querySelector("#evolutionList");
    button.disabled = true;
    evolutionList.textContent = "Loading evolution chain...";

    try {
        const speciesResponse = await fetch(currentSpeciesUrl);

        if (!speciesResponse.ok) {
            throw new Error("Evolution data is unavailable.");
        }

        const species = await speciesResponse.json();
        const evolutionResponse = await fetch(species.evolution_chain.url);

        if (!evolutionResponse.ok) {
            throw new Error("Evolution data is unavailable.");
        }

        const evolution = await evolutionResponse.json();
        const names = collectEvolutionNames(evolution.chain);
        evolutionList.textContent = names.map(formatName).join(" -> ");
    } catch (error) {
        evolutionList.textContent = error.message;
    } finally {
        button.disabled = false;
    }
}

function collectEvolutionNames(chain) {
    const names = [];

    walkEvolutionChain(chain, names);

    return names;
}

function walkEvolutionChain(chain, names) {
    names.push(chain.species.name);

    chain.evolves_to.forEach((nextChain) => walkEvolutionChain(nextChain, names));
}

function normalizePokemonQuery(value) {
    return String(value).trim().toLowerCase().replace(/\s+/g, "-");
}

function setLoading(isLoading, mode) {
    searchButton.disabled = isLoading;
    randomButton.disabled = isLoading;

    if (isLoading) {
        const message = mode === "random" ? "Finding a surprise Pokemon" : "Searching the Pokedex";
        setStatus(message, false, true);
        return;
    }

    statusMessage.classList.remove("loading");
}

function setStatus(message, isError = false, isLoading = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
    statusMessage.classList.toggle("loading", isLoading);
}

function highlightMatch(name, query) {
    const normalizedName = name.toLowerCase();
    const index = normalizedName.indexOf(query);

    if (index === -1) {
        return name;
    }

    const before = name.slice(0, index);
    const match = name.slice(index, index + query.length);
    const after = name.slice(index + query.length);

    return `${before}<mark>${match}</mark>${after}`;
}

function formatName(name) {
    return String(name)
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
