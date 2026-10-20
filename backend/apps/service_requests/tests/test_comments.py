from apps.core.testing import BaseAPITestCase, make_admin, make_citizen, make_request

BASE = "/api/requests/"


class CommentTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = make_admin(full_name="Grace Admin")
        self.citizen = make_citizen(full_name="Jane Citizen")
        self.request = make_request(self.citizen)
        self.url = f"{BASE}{self.request.reference}/comments/"

    def test_admin_can_post_an_update_and_citizen_sees_it(self):
        self.client.force_login(self.admin)
        response = self.client.post(self.url, {"body": "A technician will visit on Tuesday."})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["author_role"], "admin")
        self.assertEqual(response.data["author_name"], "Grace Admin")

        self.client.force_login(self.citizen)
        listing = self.client.get(self.url)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data), 1)
        self.assertEqual(listing.data[0]["body"], "A technician will visit on Tuesday.")
        self.assertEqual(listing.data[0]["author_name"], "Service team", "staff names are not shown to citizens")

    def test_citizen_can_reply_on_their_own_request(self):
        self.client.force_login(self.citizen)
        response = self.client.post(self.url, {"body": "Thank you, I'll be home all day."})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["author_name"], "Jane Citizen")

        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(self.url).data[0]["author_name"], "Jane Citizen")

    def test_comments_appear_in_request_detail_in_order(self):
        self.client.force_login(self.admin)
        self.client.post(self.url, {"body": "first"})
        self.client.post(self.url, {"body": "second"})
        detail = self.client.get(f"{BASE}{self.request.reference}/")
        self.assertEqual([c["body"] for c in detail.data["comments"]], ["first", "second"])

    def test_empty_and_whitespace_comments_are_rejected(self):
        self.client.force_login(self.citizen)
        for body in ("", "    "):
            with self.subTest(body=body):
                response = self.client.post(self.url, {"body": body})
                self.assertEqual(response.status_code, 400)
                self.assertIn("body", response.data["errors"])
        self.assertEqual(self.request.comments.count(), 0)

    def test_overlong_comment_is_rejected(self):
        self.client.force_login(self.citizen)
        response = self.client.post(self.url, {"body": "x" * 1001})
        self.assertEqual(response.status_code, 400)

    def test_comment_markup_is_returned_verbatim_for_the_client_to_escape(self):
        # The API stores text; React escapes on render. Make sure nothing is silently altered or executed.
        self.client.force_login(self.citizen)
        response = self.client.post(self.url, {"body": "<b>bold</b> & <script>x</script>"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["body"], "<b>bold</b> & <script>x</script>")
