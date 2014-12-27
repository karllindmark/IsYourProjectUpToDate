from django.http import HttpResponse
import json


class JsonHttpResponseBuilder(object):
    """ HttpReponse builder for JSON output """
    def __init__(self, status, message, extras=None):
        if not extras:
            extras = dict()

        self.status = status
        self.message = message
        self.extras = extras

    def build(self):
        """
        :return: HttpResponse object with JSON content
        """
        response = {"status": self.status, "message": self.message}
        if type(self.extras) is list:
            self.extras = {"data": self.extras}

        for key, value in self.extras.iteritems():
            response[key] = value
        return HttpResponse(json.dumps(response))
