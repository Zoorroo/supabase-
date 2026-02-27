import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let currentUser = null
let realtimeChannel = null

// Elements DOM
const elCurrentUserLabel = document.getElementById('current-user-label')
const btnLogout = document.getElementById('btn-logout')

const formLogin = document.getElementById('form-login')
const loginMessage = document.getElementById('login-message')
const formSignup = document.getElementById('form-signup')
const signupMessage = document.getElementById('signup-message')

const formNewPost = document.getElementById('form-new-post')
const newPostMessage = document.getElementById('new-post-message')
const newPostAuthWarning = document.getElementById('new-post-auth-warning')

const postsList = document.getElementById('posts-list')
const postsInfo = document.getElementById('posts-info')

const statTotalPosts = document.getElementById('stat-total-posts')
const statAvgComments = document.getElementById('stat-avg-comments')
const statAvgPosts = document.getElementById('stat-avg-posts')
const btnRefreshStats = document.getElementById('btn-refresh-stats')

function isAdmin(user) {
  if (!user || !user.email) return false
  return user.email.endsWith('@admin.mydomain.com')
}

function showMessage(el, msg, isError = false) {
  el.textContent = msg
  el.classList.remove('text-success', 'text-danger')
  el.classList.add(isError ? 'text-danger' : 'text-success')
}

function resetMessage(el) {
  el.textContent = ''
  el.classList.remove('text-success', 'text-danger')
}

function updateAuthUI() {
  if (currentUser) {
    elCurrentUserLabel.textContent = `${currentUser.email} ${
      isAdmin(currentUser) ? '(admin)' : ''
    }`
    btnLogout.classList.remove('d-none')
    newPostAuthWarning.classList.add('d-none')
    formNewPost.querySelectorAll('input, textarea, button').forEach((el) => {
      el.disabled = false
    })
  } else {
    elCurrentUserLabel.textContent = 'Non connecté'
    btnLogout.classList.add('d-none')
    newPostAuthWarning.classList.remove('d-none')
    formNewPost.querySelectorAll('input, textarea, button').forEach((el) => {
      el.disabled = true
    })
  }
}

async function refreshSession() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  currentUser = user
  updateAuthUI()
}

// Auth handlers
formSignup.addEventListener('submit', async (e) => {
  e.preventDefault()
  resetMessage(signupMessage)

  const email = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    console.log('signUp result', { data, error })

    if (error) {
      showMessage(signupMessage, error.message, true)
      alert('Erreur inscription : ' + error.message)
    } else {
      showMessage(
        signupMessage,
        "Compte créé. Vérifiez votre email pour confirmer l'inscription."
      )
      formSignup.reset()
    }
  } catch (err) {
    console.error('signUp exception', err)
    showMessage(
      signupMessage,
      'Erreur technique (voir console navigateur).',
      true
    )
    alert('Erreur technique inscription (voir console).')
  }
})

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault()
  resetMessage(loginMessage)

  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    console.log('signIn result', { data, error })

    if (error) {
      showMessage(loginMessage, error.message, true)
      alert('Erreur connexion : ' + error.message)
    } else {
      currentUser = data.user
      updateAuthUI()
      showMessage(loginMessage, 'Connecté avec succès.')
      formLogin.reset()
    }
  } catch (err) {
    console.error('signIn exception', err)
    showMessage(
      loginMessage,
      'Erreur technique (voir console navigateur).',
      true
    )
    alert('Erreur technique connexion (voir console).')
  }
})

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut()
  currentUser = null
  updateAuthUI()
  resetMessage(loginMessage)
})

// Posts & comments
async function loadPosts() {
  postsInfo.textContent = 'Chargement...'
  postsList.innerHTML = ''

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, content, created_at, user_id, comments(id, content, created_at, user_id)')
    .order('created_at', { ascending: false })
    .order('created_at', { foreignTable: 'comments', ascending: true })

  if (error) {
    postsInfo.textContent = `Erreur : ${error.message}`
    return
  }

  if (!posts || posts.length === 0) {
    postsInfo.textContent = 'Aucun post pour le moment.'
    return
  }

  postsInfo.textContent = `${posts.length} post(s)`

  posts.forEach((post) => {
    const card = document.createElement('div')
    card.className = 'card'

    const header = document.createElement('div')
    header.className = 'card-header d-flex justify-content-between align-items-center'

    const titleSpan = document.createElement('span')
    titleSpan.innerHTML = `<strong>${escapeHtml(post.title)}</strong>`

    const metaSpan = document.createElement('span')
    metaSpan.className = 'small text-muted'
    const created = new Date(post.created_at).toLocaleString()
    metaSpan.textContent = `Créé le ${created}`

    header.appendChild(titleSpan)
    header.appendChild(metaSpan)

    const body = document.createElement('div')
    body.className = 'card-body'

    const contentP = document.createElement('p')
    contentP.textContent = post.content
    body.appendChild(contentP)

    const footer = document.createElement('div')
    footer.className =
      'card-footer d-flex justify-content-between align-items-center flex-wrap gap-2'

    const commentsCount = (post.comments || []).length
    const toggleCommentsBtn = document.createElement('button')
    toggleCommentsBtn.className = 'btn btn-sm btn-outline-secondary'
    toggleCommentsBtn.textContent = `Commentaires (${commentsCount})`

    const commentsContainerId = `comments-${post.id}`
    toggleCommentsBtn.setAttribute('data-bs-toggle', 'collapse')
    toggleCommentsBtn.setAttribute('data-bs-target', `#${commentsContainerId}`)

    footer.appendChild(toggleCommentsBtn)

    if (currentUser && isAdmin(currentUser)) {
      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'btn btn-sm btn-outline-danger ms-auto'
      deleteBtn.textContent = 'Supprimer le post'
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Supprimer ce post ?')) return
        const { error: delError } = await supabase
          .from('posts')
          .delete()
          .eq('id', post.id)
        if (delError) {
          alert('Erreur suppression: ' + delError.message)
        }
      })
      footer.appendChild(deleteBtn)
    }

    const commentsWrapper = document.createElement('div')
    commentsWrapper.className = 'collapse mt-2'
    commentsWrapper.id = commentsContainerId

    const commentsList = document.createElement('div')
    commentsList.className = 'vstack gap-2 mb-2'

    ;(post.comments || []).forEach((comment) => {
      commentsList.appendChild(renderComment(post.id, comment))
    })

    const commentForm = document.createElement('form')
    commentForm.className = 'mt-2'

    const textarea = document.createElement('textarea')
    textarea.className = 'form-control mb-2'
    textarea.rows = 2
    textarea.placeholder = 'Votre commentaire...'
    textarea.required = true

    const submitBtn = document.createElement('button')
    submitBtn.type = 'submit'
    submitBtn.className = 'btn btn-sm btn-primary'
    submitBtn.textContent = 'Commenter'

    if (!currentUser) {
      textarea.disabled = true
      submitBtn.disabled = true
      submitBtn.textContent = 'Connectez-vous pour commenter'
    }

    commentForm.appendChild(textarea)
    commentForm.appendChild(submitBtn)

    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (!currentUser) {
        alert('Vous devez être connecté pour commenter.')
        return
      }
      const content = textarea.value.trim()
      if (!content) return
      const { error: insertError } = await supabase.from('comments').insert({
        post_id: post.id,
        content,
        user_id: currentUser.id,
      })
      if (insertError) {
        alert('Erreur ajout commentaire: ' + insertError.message)
      } else {
        textarea.value = ''
        // Mise à jour immédiate pour l'utilisateur qui commente
        await loadPosts()
        await loadStats()
      }
    })

    commentsWrapper.appendChild(commentsList)
    commentsWrapper.appendChild(commentForm)

    body.appendChild(commentsWrapper)

    card.appendChild(header)
    card.appendChild(body)
    card.appendChild(footer)

    postsList.appendChild(card)
  })
}

function renderComment(postId, comment) {
  const wrapper = document.createElement('div')
  wrapper.className = 'border rounded p-2 d-flex justify-content-between align-items-start gap-2'

  const textDiv = document.createElement('div')
  const p = document.createElement('p')
  p.className = 'mb-1'
  p.textContent = comment.content

  const meta = document.createElement('div')
  meta.className = 'small text-muted'
  const created = new Date(comment.created_at).toLocaleString()
  meta.textContent = `Le ${created}`

  textDiv.appendChild(p)
  textDiv.appendChild(meta)

  wrapper.appendChild(textDiv)

  if (currentUser && isAdmin(currentUser)) {
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn btn-sm btn-outline-danger'
    deleteBtn.textContent = 'Supprimer'
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce commentaire ?')) return
      const { error: delError } = await supabase
        .from('comments')
        .delete()
        .eq('id', comment.id)
      if (delError) {
        alert('Erreur suppression: ' + delError.message)
      }
    })
    wrapper.appendChild(deleteBtn)
  }

  return wrapper
}

formNewPost.addEventListener('submit', async (e) => {
  e.preventDefault()
  resetMessage(newPostMessage)

  if (!currentUser) {
    showMessage(newPostMessage, 'Vous devez être connecté pour poster.', true)
    return
  }

  const title = document.getElementById('post-title').value.trim()
  const content = document.getElementById('post-content').value.trim()

  if (!title || !content) {
    showMessage(newPostMessage, 'Titre et contenu sont obligatoires.', true)
    return
  }

  const { error } = await supabase.from('posts').insert({
    title,
    content,
    user_id: currentUser.id,
  })

  if (error) {
    showMessage(newPostMessage, error.message, true)
  } else {
    showMessage(newPostMessage, 'Post créé avec succès.')
    formNewPost.reset()
    // Mise à jour immédiate pour l'utilisateur qui publie
    await loadPosts()
    await loadStats()
  }
})

// Stats
async function loadStats() {
  const { data, error } = await supabase.rpc('get_blog_stats')
  if (error) {
    statTotalPosts.textContent = 'Erreur'
    statAvgComments.textContent = 'Erreur'
    statAvgPosts.textContent = 'Erreur'
    console.error('Erreur stats:', error)
    return
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    statTotalPosts.textContent = '0'
    statAvgComments.textContent = '0'
    statAvgPosts.textContent = '0'
    return
  }

  statTotalPosts.textContent = row.total_posts
  statAvgComments.textContent = Number(row.avg_comments_per_post).toFixed(2)
  statAvgPosts.textContent = Number(row.avg_posts_per_user).toFixed(2)
}

btnRefreshStats.addEventListener('click', () => {
  loadStats()
})

// Realtime
function setupRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
  }

  realtimeChannel = supabase
    .channel('realtime:blog')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'posts' },
      () => {
        loadPosts()
        loadStats()
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments' },
      () => {
        loadPosts()
        loadStats()
      }
    )
    .subscribe()
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return c
    }
  })
}

// Initialisation
;(async function init() {
  await refreshSession()
  await loadPosts()
  await loadStats()
  setupRealtime()

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null
    updateAuthUI()
    await loadPosts()
    await loadStats()
  })
})()

